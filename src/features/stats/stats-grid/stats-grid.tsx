import { AgGridReact } from 'ag-grid-react';
import { useEffect, useState } from 'react';
import { IStatItem } from '../../../types/stats.types';
import { STATS_API } from '../../../api/stats.api';

import {
    CellClickedEvent,
    ColDef,
    IServerSideDatasource,
    IServerSideGetRowsRequest,
    RowGroupOpenedEvent,
    themeBalham,
} from 'ag-grid-enterprise';

import { useSearchParams } from 'react-router-dom';
import { Metrics } from '../stats.const';
import { statsGridColumnsFactory } from './stats-grid.columns';
import { generateLevelPath } from '../../../utils/getPath.ts';
import { ServerSideRowModelModule } from 'ag-grid-enterprise';

import './stats-grid.scss';

const dates = Array.from({ length: 30 }, (_, i) => new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

export function StatsGrid() {
    const [columnDefs, setColumnDefs] = useState<ColDef<IStatItem>[]>([]);
    const [searchParams] = useSearchParams();
    const metric = searchParams.get('metric') ?? Metrics.cost;

    function cellClicked(event: CellClickedEvent) {
        const path = generateLevelPath(event.node);
        console.log('Clicked level:', path.length, path);
    }

    function groupOpened(event: RowGroupOpenedEvent) {
        const path = generateLevelPath(event.node);
        console.log('Group opened level:', path.length, path);
    }

    // ------------ SERVER ------------

    function createFakeServer() {
        return {
            getData: (request: IServerSideGetRowsRequest) => {
                const level = request.groupKeys.length;

                return new Promise<{
                    success: boolean;
                    rows: any[];
                }>((resolve) => {
                    const worker = new Worker(new URL('../../../workers/upgrade-data.worker.ts', import.meta.url), { type: 'module' });

                    STATS_API.getFull().then((data) => {
                        worker.postMessage({ data, dates });
                    });

                    worker.onmessage = (event) => {
                        const { suppliers, brands, types, articles } = event.data;

                        let rows: any[] = [];

                        // 🟢 1 УРОВЕНЬ: Поставщики
                        if (level === 0) {
                            rows = suppliers.map((s: any) => ({
                                supplier: s.supplier,
                                __isGroup: true,
                            }));
                        }

                        // 🟡 2 УРОВЕНЬ: Бренды
                        if (level === 1) {
                            const supplier = request.groupKeys[0];

                            rows = brands
                                .filter((b: any) => b.supplier === supplier)
                                .map((b: any) => ({
                                    brand: b.brand,
                                    supplier,
                                    __isGroup: true,
                                }));
                        }

                        // 🔵 3 УРОВЕНЬ: Типы
                        if (level === 2) {
                            const supplier = request.groupKeys[0];
                            const brand = request.groupKeys[1];

                            rows = types
                                .filter((t: any) => t.supplier === supplier && t.brand === brand)
                                .map((t: any) => ({
                                    type: t.type,
                                    supplier,
                                    brand,
                                    __isGroup: true,
                                }));
                        }

                        // 🟣 4 УРОВЕНЬ: Артикулы
                        if (level === 3) {
                            const supplier = request.groupKeys[0];
                            const brand = request.groupKeys[1];
                            const type = request.groupKeys[2];

                            rows = articles.filter((a: any) => a.supplier === supplier && a.brand === brand && a.type === type);
                        }

                        const page = rows.slice(request.startRow, request.endRow);

                        resolve({
                            success: true,
                            rows: page,
                        });
                    };

                    worker.onerror = (error) => {
                        console.error('Worker error:', error);
                    };
                });
            },
        };
    }

    function createServerSideDatasource(server: ReturnType<typeof createFakeServer>): IServerSideDatasource {
        return {
            getRows: (params) => {
                console.log('[Datasource request]', params.request);

                server.getData(params.request).then((res) => {
                    if (res.success) {
                        params.success({
                            rowData: res.rows,
                        });
                    } else {
                        params.fail();
                    }
                });
            },
        };
    }

    // ------------ EFFECTS ------------

    useEffect(() => {
        const cols = statsGridColumnsFactory(metric, dates);

        /*
          ВАЖНО: группы показываются так,
          но сами колонки скрыты
        */
        const grouping: ColDef[] = [
            {
                field: 'supplier',
                rowGroup: true,
                hide: true,
            },
            {
                field: 'brand',
                rowGroup: true,
                hide: true,
            },
            {
                field: 'type',
                rowGroup: true,
                hide: true,
            },
        ];

        setColumnDefs([...grouping, ...cols]);
    }, [metric]);

    // ------------ RENDER ------------

    return (
        <div className='stats-grid ag-theme-balham'>
            <AgGridReact<IStatItem>
                modules={[ServerSideRowModelModule]}
                rowModelType='serverSide'
                cacheBlockSize={50}
                maxBlocksInCache={5}
                isServerSideGroup={(data) => !!data?.__isGroup}
                getServerSideGroupKey={(data: any) => data.supplier ?? data.brand ?? data.type}
                autoGroupColumnDef={{
                    headerName: 'Группа',
                    pinned: 'left',
                    cellRendererParams: {
                        suppressCount: true,
                    },
                }}
                suppressAggFuncInHeader={true}
                theme={themeBalham.withParams({
                    backgroundColor: 'var(--bs-body-bg)',
                    foregroundColor: 'var(--bs-body-color)',
                    browserColorScheme: 'light',
                })}
                onGridReady={(params) => {
                    const fakeServer = createFakeServer();
                    const datasource = createServerSideDatasource(fakeServer);

                    params.api.setGridOption('serverSideDatasource', datasource);
                }}
                columnDefs={columnDefs}
                onCellClicked={cellClicked}
                onRowGroupOpened={groupOpened}
            />
        </div>
    );
}
