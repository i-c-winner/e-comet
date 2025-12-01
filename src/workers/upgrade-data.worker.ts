import { IStatItem } from '../types/stats.types';
import { AdStatsDatabase } from '../dbs/stats.db.ts';

const db = AdStatsDatabase.getInstance('user');
const addedBrands: string[] = [];
const addedSuppliers: string[] = [];
const addedTypes: string[] = [];

self.onmessage = (event: { data: { data: IStatItem[]; dates: string[] } }) => {
    const items = event.data.data;
    const dates = event.data.dates;
    const normalizedDates = items.map((item) => new Date(item.lastUpdate).setHours(0, 0, 0, 0));
    const articles: Record<string, IStatItem[]> = {};
    const brands: Partial<IStatItem>[] = [];
    const suppliers: Partial<IStatItem>[] = [];
    const types: Partial<IStatItem>[] = [];

    let i = 0;
    while (i < items.length) {
        const revenue: number[] = [];
        const buyouts: number[] = [];

        let j = 0;
        let length = dates.length;
        while (j < dates.length) {
            let cost = items[i].cost[j];
            let orders = items[i].orders[j];
            let returns = items[i].returns[j];
            buyouts.push(orders - returns);
            revenue.push(cost * buyouts[j]);
            if (normalizedDates[i] < new Date(dates[j]).setHours(0, 0, 0, 0)) {
                if (length > 1) length -= 1;
                items[i].cost[j] = 0;
                items[i].orders[j] = 0;
                items[i].returns[j] = 0;
                revenue[j] = 0;
                buyouts[j] = 0;
            }
            j++;
        }

        const sumRevenue = revenue.reduce((acc, cur) => acc + cur, 0);
        const avgRevenue = sumRevenue / length;
        const sumBuyouts = buyouts.reduce((acc, cur) => acc + cur, 0);
        const avgBuyouts = sumBuyouts / length;
        const sumCost = items[i].cost.reduce((acc, cur) => acc + cur, 0);
        const avgCost = sumCost / length;
        const sumOrders = items[i].orders.reduce((acc, cur) => acc + cur, 0);
        const avgOrders = sumOrders / length;
        const sumReturns = items[i].returns.reduce((acc, cur) => acc + cur, 0);
        const avgReturns = sumReturns / length;

        items[i].revenue = revenue;
        items[i].buyouts = buyouts;
        if (!items[i].average) {
            items[i].average = {
                revenue: 0,
                buyouts: 0,
                cost: 0,
                orders: 0,
                returns: 0,
            };
        }
        if (!items[i].sums) {
            items[i].sums = {
                revenue: 0,
                buyouts: 0,
                cost: 0,
                orders: 0,
                returns: 0,
            };
        }
        const avg = items[i].average;
        const sums = items[i].sums;
        avg!.revenue = Math.floor(avgRevenue);
        avg!.buyouts = Math.floor(avgBuyouts);
        avg!.cost = Math.floor(avgCost);
        avg!.orders = Math.floor(avgOrders);
        avg!.returns = Math.floor(avgReturns);
        sums!.revenue = sumRevenue;
        sums!.buyouts = sumBuyouts;
        sums!.cost = sumCost;
        sums!.orders = sumOrders;
        sums!.returns = sumReturns;

        const article = items[i].article as string;
        if (!articles[article]) {
            articles[article] = [];
        }
        articles[article]?.push(items[i] as IStatItem);
        if (!addedBrands.includes(items[i].brand)) {
            addedBrands.push(items[i].brand);
            brands.push({ brand: items[i].brand, supplier: items[i].supplier, sums, average: avg });
        }
        if (!addedSuppliers.includes(items[i].supplier)) {
            addedSuppliers.push(items[i].supplier);
            suppliers.push({ supplier: items[i].supplier, sums, average: avg });
        }
        if (!addedTypes.includes(items[i].type)) {
            addedTypes.push(items[i].type);
            types.push({ supplier: items[i].supplier, brand: items[i].brand, type: items[i].type, sums, average: avg });
        }
        i++;
    }
    db.updateDB(articles, brands, suppliers, types);
    self.postMessage({ items, articles, brands, suppliers, types });
};
