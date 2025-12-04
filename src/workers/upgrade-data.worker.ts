import { IStatItem } from '../types/stats.types.ts';
import { AdStatsDatabase } from '../dbs/stats.db.ts';
import { STATS_API } from '../api/stats.api.ts';

const db = AdStatsDatabase.getInstance('user');
self.onmessage = (event: { data: { dates: string[] } }) => {
    STATS_API.getFull()
        .then((data: IStatItem[]) => {
            const items = data;
            const dates = event.data.dates;

            const normalizedDates = items.map((item) => new Date(item.lastUpdate).setHours(0, 0, 0, 0));
            const normalizedTargetDates = dates.map((date) => new Date(date).setHours(0, 0, 0, 0));

            const brandsMap = new Map<string, { sums: any; average: any }>();
            const suppliersMap = new Map<string, { sums: any; average: any }>();
            const typesMap = new Map<string, { sums: any; average: any }>();

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const revenue: number[] = [];
                const buyouts: number[] = [];

                const costArray = item.cost;
                const ordersArray = item.orders;
                const returnsArray = item.returns;
                const itemDate = normalizedDates[i];

                let validLength = dates.length;

                for (let j = 0; j < dates.length; j++) {
                    const buyout = ordersArray[j] - returnsArray[j];
                    const rev = costArray[j] * buyout;

                    buyouts.push(buyout);
                    revenue.push(rev);
                    if (itemDate < normalizedTargetDates[j]) {
                        if (validLength > 1) validLength--;
                        costArray[j] = 0;
                        ordersArray[j] = 0;
                        returnsArray[j] = 0;
                        revenue[j] = 0;
                        buyouts[j] = 0;
                    }
                }

                let sumRevenue = 0,
                    sumBuyouts = 0,
                    sumCost = 0,
                    sumOrders = 0,
                    sumReturns = 0;

                for (let j = 0; j < revenue.length; j++) {
                    sumRevenue += revenue[j];
                    sumBuyouts += buyouts[j];
                    sumCost += costArray[j];
                    sumOrders += ordersArray[j];
                    sumReturns += returnsArray[j];
                }

                const avgRevenue = sumRevenue / validLength;
                const avgBuyouts = sumBuyouts / validLength;
                const avgCost = sumCost / validLength;
                const avgOrders = sumOrders / validLength;
                const avgReturns = sumReturns / validLength;

                item.revenue = revenue;
                item.buyouts = buyouts;

                if (!item.average) item.average = { revenue: 0, buyouts: 0, cost: 0, orders: 0, returns: 0 };
                if (!item.sums) item.sums = { revenue: 0, buyouts: 0, cost: 0, orders: 0, returns: 0 };

                const avg = item.average;
                const sums = item.sums;

                avg.revenue = Math.floor(avgRevenue);
                avg.buyouts = Math.floor(avgBuyouts);
                avg.cost = Math.floor(avgCost);
                avg.orders = Math.floor(avgOrders);
                avg.returns = Math.floor(avgReturns);

                sums.revenue = sumRevenue;
                sums.buyouts = sumBuyouts;
                sums.cost = sumCost;
                sums.orders = sumOrders;
                sums.returns = sumReturns;

                const brandKey = `${item.brand}|${item.supplier}`;
                if (!brandsMap.has(brandKey)) {
                    brandsMap.set(brandKey, { sums, average: avg });
                }

                if (!suppliersMap.has(item.supplier)) {
                    suppliersMap.set(item.supplier, { sums, average: avg });
                }

                const typeKey = `${item.supplier}|${item.brand}|${item.type}`;
                if (!typesMap.has(typeKey)) {
                    typesMap.set(typeKey, { sums, average: avg });
                }
            }
            const brands = Array.from(brandsMap.entries()).map(([key, data]) => {
                const [brand, supplier] = key.split('|');
                return { brand, supplier, ...data };
            });

            const suppliers = Array.from(suppliersMap.entries()).map(([supplier, data]) => ({
                supplier,
                ...data,
            }));

            const types = Array.from(typesMap.entries()).map(([key, data]) => {
                const [supplier, brand, type] = key.split('|');
                return { supplier, brand, type, ...data };
            });
            const articles = items;
            db.updateDB(articles, brands, suppliers, types);
            self.postMessage({ articles, brands, suppliers, types });
        })
        .catch((err) => console.error(err));
};
