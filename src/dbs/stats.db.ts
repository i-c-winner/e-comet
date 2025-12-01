import Dexie, { Table } from 'dexie';
import { IStatItem } from '../types/stats.types';

export class AdStatsDatabase extends Dexie {
    private static instance: AdStatsDatabase | null = null;

    article!: Table<IStatItem & { id?: number }, number>;
    brand!: Table<Partial<IStatItem> & { id?: number }, number>;
    supplier!: Table<Partial<IStatItem> & { id?: number }, number>;
    type!: Table<Partial<IStatItem> & { id?: number }, number>;

    private constructor(user_uuid: string) {
        super(`AdStatsDatabase_${user_uuid}`);

        this.version(1).stores({
            article: '++id, [supplier+brand+type+article]',
            brand: '++id, [supplier+brand]',
            supplier: '++id, supplier',
            type: '++id, type',
        });

        this.article = this.table('article');
        this.brand = this.table('brand');
        this.supplier = this.table('supplier');
        this.type = this.table('type');
    }

    public static getInstance(user_uuid: string): AdStatsDatabase {
        if (!AdStatsDatabase.instance) {
            AdStatsDatabase.instance = new AdStatsDatabase(user_uuid);
        }

        return AdStatsDatabase.instance;
    }

    private async saveGroup(
        data: Record<string, Partial<IStatItem>[]> | Partial<IStatItem>[],
        table: Table<Partial<IStatItem> & { id?: number }, number>,
    ): Promise<void> {
        table.clear();
        if (Array.isArray(data)) {
            await table.bulkPut(data);
            return;
        }
        const flatList = Object.values(data).flat();
        if (flatList.length) {
            await table.bulkPut(flatList);
        }
    }

    public async updateDB(
        articles: Record<string, IStatItem[]>,
        brands: Partial<IStatItem>[],
        suppliers: Partial<IStatItem>[],
        types: Partial<IStatItem>[],
    ): Promise<void> {
        await Promise.all([
            this.saveGroup(articles, this.article),
            this.saveGroup(brands, this.brand),
            this.saveGroup(suppliers, this.supplier),
            this.saveGroup(types, this.type),
        ]);
    }
}
