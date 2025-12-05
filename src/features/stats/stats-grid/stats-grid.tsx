import { AgGridReact } from 'ag-grid-react';
import { useEffect, useRef, useState } from 'react';
import { IStatItem } from '../../../types/stats.types';
import { ColDef, IServerSideDatasource, IServerSideGetRowsRequest, themeBalham } from 'ag-grid-enterprise';
import { useSearchParams } from 'react-router-dom';
import { Metrics } from '../stats.const';
import { statsGridColumnsFactory } from './stats-grid.columns';
import { ServerSideRowModelModule } from 'ag-grid-enterprise';
import { AdStatsDatabase } from '../../../dbs/stats.db.ts';
import './stats-grid.scss';
import { useTranslation } from 'react-i18next';

const dates = Array.from({ length: 30 }, (_, i) => new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
const db = AdStatsDatabase.getInstance('user');
const lastUpdateStorage = localStorage.getItem('lastUpdate');
const lastUpdate = lastUpdateStorage ? Number(lastUpdateStorage) : undefined;
const DAY = 24 * 60 * 60 * 1000;

export function StatsGrid() {
    // ----------------------- HOOKS --------------------

    const refWorker = useRef<Worker>(new Worker(new URL('../../../workers/upgrade-data.worker.ts', import.meta.url), { type: 'module' }));
    const [currentDate, setCurrentDate] = useState<{
        articles: IStatItem[];
        brands: IStatItem[];
        suppliers: IStatItem[];
        types: IStatItem[];
    }>({
        articles: [],
        brands: [],
        suppliers: [],
        types: [],
    });
    const [started, setStarted] = useState<boolean>(false);
    const [columnDefs, setColumnDefs] = useState<ColDef<IStatItem>[]>([]);
    const [searchParams] = useSearchParams();
    const metric = searchParams.get('metric') ?? Metrics.cost;
    const { t } = useTranslation();

    // ------------ SERVER ------------

    function createFakeServer() {
        const groupByLevel = (items: IStatItem[], groupKeys: string[], level: number) => {
            let filtered = [...items];

            if (groupKeys.length >= 1) {
                filtered = filtered.filter((item) => item.supplier === groupKeys[0]);
            }
            if (groupKeys.length >= 2) {
                filtered = filtered.filter((item) => item.brand === groupKeys[1]);
            }
            if (groupKeys.length >= 3) {
                filtered = filtered.filter((item) => item.type === groupKeys[2]);
            }

            if (level === 0) {
                const suppliers = [...new Set(filtered.map((item) => item.supplier))];
                return suppliers.map((supplier) => ({
                    supplier,
                    __isGroup: true,
                    __level: 0,
                }));
            } else if (level === 1) {
                const brands = [...new Set(filtered.map((item) => item.brand))];
                return brands.map((brand) => ({
                    supplier: groupKeys[0],
                    brand,
                    __isGroup: true,
                    __level: 1,
                }));
            } else if (level === 2) {
                const types = [...new Set(filtered.map((item) => item.type))];
                return types.map((type) => ({
                    supplier: groupKeys[0],
                    brand: groupKeys[1],
                    type,
                    __isGroup: true,
                    __level: 2,
                }));
            } else if (level === 3) {
                return filtered;
            }

            return [];
        };

        return {
            getData: (request: IServerSideGetRowsRequest) => {
                const level = request.groupKeys.length;

                return new Promise<{
                    success: boolean;
                    rows: IStatItem[];
                }>((resolve) => {
                    // Определяем, какие данные использовать на основе уровня
                    let sourceData: IStatItem[] = [];

                    if (level === 0) {
                        sourceData = currentDate.suppliers;
                    } else if (level === 1) {
                        sourceData = currentDate.brands;
                    } else if (level === 2) {
                        sourceData = currentDate.types;
                    } else if (level === 3) {
                        sourceData = currentDate.articles;
                    }

                    const rows = groupByLevel(sourceData, request.groupKeys, level) as IStatItem[];

                    // Пагинация
                    const startRow = request.startRow || 0;
                    const endRow = request.endRow || rows.length;
                    const page = rows.slice(startRow, endRow);

                    resolve({
                        success: true,
                        rows: page,
                    });
                });
            },
        };
    }

    function createServerSideDatasource(server: ReturnType<typeof createFakeServer>): IServerSideDatasource {
        return {
            getRows: (params) => {
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

    // ------------ LOGIC --------------

    const isFresh = () => {
        if (lastUpdate === undefined) return false;
        return Date.now() - lastUpdate < DAY;
    };

    const getData = async () => {
        const [articles, brands, suppliers, types] = await Promise.all([
            db.article.toArray(),
            db.brand.toArray(),
            db.supplier.toArray(),
            db.type.toArray(),
        ]);

        return {
            articles,
            brands,
            suppliers,
            types,
        };
    };
    function getDataFromServer(data: {
        articles: (Partial<IStatItem> & {
            id?: number;
        })[];
        brands: (Partial<IStatItem> & {
            id?: number;
        })[];
        suppliers: (Partial<IStatItem> & {
            id?: number;
        })[];
        types: (Partial<IStatItem> & {
            id?: number;
        })[];
    }) {
        if (data.suppliers.length === 0 || !isFresh()) {
            refWorker.current.postMessage({ dates });
            localStorage.setItem('lastUpdate', Date.now().toString());
            refWorker.current.onmessage = (event) => {
                const { suppliers, brands, types, articles } = event.data;
                setCurrentDate({ suppliers, brands, types, articles });
                setStarted(true);
            };

            refWorker.current.onerror = (error) => {
                console.error('Worker error:', error);
            };
        } else {
            setCurrentDate({
                articles: data.articles as IStatItem[],
                brands: data.brands as IStatItem[],
                types: data.types as IStatItem[],
                suppliers: data.suppliers as IStatItem[],
            });
            setStarted(true);
        }
    }

    // ------------ EFFECTS ------------

    useEffect(() => {
        const cols = statsGridColumnsFactory(metric, dates);

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

    useEffect(() => {
        /**
         * логика обращения к базе данных-
         * Пытаемся получить данные через функцию getData.
         * получаем данные из indexDB дазы данных.
         * если получаем пустой массив (данных в базе данных нет) или срок
         * после последнего обновления больше 24 часов мы обращаемся на сервер за данными.
         * если меньше 24 часов и есть данные на локальной базе
         * то мы получаем их из локальной базы.
         * И в том и другом случае сохраняем их в State компонента
         * и работаем уже с ним.
         */
        getData()
            .then((data) => {
                getDataFromServer(data);
            })
            .catch((err) => console.error(err));
    }, []);

    useEffect(() => {
        return () => {
            if (started) refWorker.current.terminate();
        };
    }, [started]);

    // ------------ RENDER ------------

    return (
        <div className='stats-grid ag-theme-balham'>
            {started && (
                <AgGridReact<IStatItem>
                    modules={[ServerSideRowModelModule]}
                    rowModelType='serverSide'
                    cacheBlockSize={50}
                    maxBlocksInCache={5}
                    isServerSideGroup={(data) => !!data?.__isGroup}
                    getServerSideGroupKey={(data) => data.supplier ?? data.brand ?? data.type}
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
                        borderColor: 'var(--bs-border-color)',
                        headerBackgroundColor: 'var(--bs-secondary-bg)',
                    })}
                    onGridReady={(params) => {
                        const fakeServer = createFakeServer();
                        const datasource = createServerSideDatasource(fakeServer);

                        params.api.setGridOption('serverSideDatasource', datasource);
                    }}
                    columnDefs={columnDefs}
                />
            )}
            {!started && <span>{t('Loading')}</span>}
        </div>
    );
}
