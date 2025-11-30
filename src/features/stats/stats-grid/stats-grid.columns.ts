import { ColDef, ColDefField, ValueFormatterParams, ValueGetterParams } from 'ag-grid-enterprise';
import { IStatItem, ORDERED_LEVELS } from '../../../types/stats.types';
import { METADATA_LABELS } from '../stats.const';

const NOT_DATA= 'Нет данных'
export function statsGridColumnsFactory<T extends IStatItem>(metric: string, dates: string[]) {
    const metadataColumns: ColDef<T>[] = ORDERED_LEVELS.map((level, index) => ({
        colId: level,
        headerName: METADATA_LABELS[level],
        field: level as ColDefField<T>,
        rowGroup: true,
        rowGroupIndex: index,
        initialHide: true,
    }));

    const sumColumn: ColDef<T> = {
        colId: 'sums',
        headerName: 'Sum',
        valueGetter: (params: ValueGetterParams<T>) => {
            return params.data?.sums?.[metric as keyof typeof params.data.sums] ?? 0;
        },
        valueFormatter: (params: ValueFormatterParams<T>) => {
            return params.value?.toLocaleString() ?? '';
        },
    };
    const averageColumn: ColDef<T> = {
        colId: 'average',
        headerName: 'Average',
        valueGetter: (params: ValueGetterParams<T>) => {
            return params.data?.average?.[metric as keyof typeof params.data.average] ?? 0;
        },
        valueFormatter: (params: ValueFormatterParams<T>) => {
            return params.value?.toLocaleString() ?? '';
        },
    };

    const datesColumns: ColDef<T>[] = dates.map((date, index) =>{
        const d1=new Date(date).setHours(0,0,0,0)

        return {
            headerName: date,
            colId: `${index}`,
            valueGetter: (params: ValueGetterParams<T>) => {
                // const d2=new Date(params.data?.lastUpdate as string).setHours(0,0,0,0)
                // if (d1>d2) return NOT_DATA;
                return params.data?.[metric as 'cost' | 'orders' | 'returns' | 'revenue' | 'buyouts']?.[index] ?? 0;
            },
            valueFormatter: (params: ValueFormatterParams<T>) => {
                return params.value?.toLocaleString() ?? '';
            },
            cellStyle: (params: ValueFormatterParams<T>) => {
                if ( params.value === 0){
                    return {
                        color: 'red',
                    }
                } return {
                    fontWeight: 'bold'
                }
            },
        }
    } );

    return [...metadataColumns, sumColumn, averageColumn, ...datesColumns];
}
