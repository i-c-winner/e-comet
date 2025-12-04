import { AgGridReact } from 'ag-grid-react';
import { useEffect, useState } from 'react';
import { IStatItem } from '../../../types/stats.types';
import { STATS_API } from '../../../api/stats.api';
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
    const worker = new Worker(new URL('../../../workers/upgrade-data.worker.ts', import.meta.url), { type: 'module' });
    const { t } = useTranslation();

    // ------------ SERVER ------------

    function createFakeServer() {
        return {
            getData: (request: IServerSideGetRowsRequest) => {
                const level = request.groupKeys.length;

                return new Promise<{
                    success: boolean;
                    rows: IStatItem[];
                }>((resolve) => {
                    let rows: IStatItem[] = [];

                    if (level === 0) {
                        rows = currentDate.suppliers.map(
                            (s: IStatItem): Partial<IStatItem> => ({
                                supplier: s.supplier,
                                __isGroup: true,
                            }),
                        ) as IStatItem[];
                    }

                    if (level === 1) {
                        const supplier = request.groupKeys[0];

                        rows = currentDate.brands
                            .filter((b: IStatItem) => b.supplier === supplier)
                            .map(
                                (b: IStatItem): Partial<IStatItem> => ({
                                    brand: b.brand,
                                    supplier,
                                    __isGroup: true,
                                }),
                            ) as IStatItem[];
                    }

                    if (level === 2) {
                        const supplier = request.groupKeys[0];
                        const brand = request.groupKeys[1];

                        rows = currentDate.types
                            .filter((t: IStatItem) => t.supplier === supplier && t.brand === brand)
                            .map(
                                (t: IStatItem): Partial<IStatItem> => ({
                                    type: t.type,
                                    supplier,
                                    brand,
                                    __isGroup: true,
                                }),
                            ) as IStatItem[];
                    }

                    if (level === 3) {
                        const supplier = request.groupKeys[0];
                        const brand = request.groupKeys[1];
                        const type = request.groupKeys[2];
                        rows = currentDate.articles.filter(
                            (a: IStatItem) => a.supplier === supplier && a.brand === brand && a.type === type,
                        );
                    }

                    const totalRows = rows.length;

                    // Берем только нужную страницу
                    const startRow = request.startRow || 0;
                    const endRow = request.endRow || totalRows;
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
        if (lastUpdate === undefined || Number.isNaN(lastUpdate)) return true;
        return Date.now() - lastUpdate > DAY;
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
            worker.postMessage(dates);
            STATS_API.getFull().then((data) => {
                worker.postMessage({ data, dates });
            });
            worker.onmessage = (event) => {
                const { suppliers, brands, types, articles } = event.data;
                setCurrentDate({ suppliers, brands, types, articles });
                setStarted(true);
                localStorage.setItem('lastUpdate', Date.now().toString());
            };

            worker.onerror = (error) => {
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
