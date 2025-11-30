import { IStatItem } from '../types/stats.types';

self.onmessage = (event: { data: { data: IStatItem[]; dates: string[] } }) => {
    const items = event.data.data;
    const dates = event.data.dates;

    let i = 0;
    while (i < items.length) {
        const revenue: number[] = [];
        const buyouts: number[] = [];

        const d1 = new Date(items[i].lastUpdate).setHours(0, 0, 0, 0);
        let j = 0;
        let length = dates.length;
        while (j < dates.length) {
            const d2 = new Date(dates[j]).setHours(0, 0, 0, 0);
            let cost = items[i].cost[j];
            let orders = items[i].orders[j];
            let returns = items[i].returns[j];
            buyouts.push(orders - returns);
            revenue.push(cost * buyouts[j]);
            if (d1 < d2) {
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
        i++;
    }

    self.postMessage(items);
};
