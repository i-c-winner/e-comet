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
    const [path, setPath] = useState<number>(0);
    const [columnDefs, setColumnDefs] = useState<ColDef<IStatItem>[]>([]);
    const [searchParams] = useSearchParams();
    const metric = searchParams.get('metric') ?? Metrics.cost;
    const [data, setData] = useState<{
        types: IStatItem[];
        brands: IStatItem[];
        suppliers: IStatItem[];
        articles: IStatItem[];
    }>({ types: [], brands: [], suppliers: [], articles: [] });

    function cellClicked(event: CellClickedEvent) {
        const path = generateLevelPath(event.node);
        setPath(path.length + 1);
    }
    function groupOpened(event: RowGroupOpenedEvent) {
        const path = generateLevelPath(event.node);
        setPath(path.length);
    }

    useEffect(() => {
        setColumnDefs(statsGridColumnsFactory(metric, dates));
    }, [metric]);

    useEffect(() => {
        switch (length) {
            case 0 || 1:
                setRowData(data.suppliers);
                break;
            case 2:
                setRowData(data.brands);
                break;
            case 3:
                setRowData(data.types);
                break;
            default:
                setRowData(data.articles);
        }
    }, [path, data]);
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
            setData({
                types,
                brands,
                suppliers,
                articles: [...Object.values(articles).flat()],
            });
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
