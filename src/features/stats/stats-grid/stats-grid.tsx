import { AgGridReact } from 'ag-grid-react';
import { useEffect, useState } from 'react';
import { IStatItem } from '../../../types/stats.types';
import { STATS_API } from '../../../api/stats.api';
import { CellClickedEvent, ColDef, RowGroupOpenedEvent, themeBalham } from 'ag-grid-enterprise';
import { useSearchParams } from 'react-router-dom';
import { Metrics } from '../stats.const';
import { statsGridColumnsFactory } from './stats-grid.columns';
import { generateLevelPath } from '../../../utils/getPath.ts';
import './stats-grid.scss';

const dates = Array.from({ length: 30 }, (_, i) => new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
export function StatsGrid() {
    const [rowData, setRowData] = useState<IStatItem[] | null>(null);
    const [columnDefs, setColumnDefs] = useState<ColDef<IStatItem>[]>([]);
    const [searchParams] = useSearchParams();
    const metric = searchParams.get('metric') ?? Metrics.cost;

    function cellClicked(event: CellClickedEvent) {
        console.log(event.node.key);
        console.log(generateLevelPath(event.node));
    }
    function groupOpened(event: RowGroupOpenedEvent) {
        console.log(generateLevelPath(event.node));
    }

    useEffect(() => {
        setColumnDefs(statsGridColumnsFactory(metric, dates));
    }, [metric]);

    useEffect(() => {
        const worker = new Worker(new URL('../../../workers/upgrade-data.worker.ts', import.meta.url), { type: 'module' });
        STATS_API.getFull().then((data) => {
            worker.postMessage({ data, dates });
        });
        worker.onmessage = (event) => {
            const { types, brands, suppliers, articles } = event.data as {
                types: IStatItem[];
                brands: IStatItem[];
                suppliers: IStatItem[];
                articles: Record<string, IStatItem[]>;
            };
            console.info('Получены данные от worker:', { types, brands, suppliers, articles });
            const flattenedDataArticles: IStatItem[] = [...Object.values(articles).flat()];
            const flattenedDataBrand = brands;

            console.log(flattenedDataBrand, 'flattenedDataBrand');

            setRowData(flattenedDataArticles);
        };

        worker.onerror = (error) => {
            console.error('Ошибка в worker:', error);
        };

        return () => worker.terminate();
    }, []);

    return (
        <div className='stats-grid ag-theme-balham'>
            <AgGridReact
                groupHideParentOfSingleChild='leafGroupsOnly'
                autoGroupColumnDef={{
                    menuTabs: ['columnsMenuTab'],
                    pinned: 'left',
                    cellRendererParams: {
                        innerRenderer: (params: any) => {
                            if (params.node.group) {
                                return params.value;
                            }
                            return params.data?.article ?? 'Артикул неизвестен';
                        },
                        suppressCount: true,
                    },
                }}
                suppressAggFuncInHeader={true}
                theme={themeBalham.withParams({
                    backgroundColor: 'var(--bs-body-bg)',
                    foregroundColor: 'var(--bs-body-color)',
                    browserColorScheme: 'light',
                })}
                rowData={rowData}
                columnDefs={columnDefs}
                onCellClicked={cellClicked}
                onRowGroupOpened={groupOpened}
            ></AgGridReact>
        </div>
    );
}
