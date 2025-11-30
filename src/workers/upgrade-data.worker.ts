import { IStatItem } from '../types/stats.types'

self.onmessage = (event: MessageEvent<IStatItem[]>) => {
    const items = event.data

    items.forEach((item) => {
        const revenue: number[] = []
        const buyouts: number[] = []
        const average: {
            cost: number
            orders: number
            returns: number
            revenue: number
            buyouts: number
        }= {
            cost: 0,
            orders: 0,
            returns: 0,
            revenue: 0,
            buyouts: 0
        }
        const sums:  {
            cost: number
            orders: number
            returns: number
            revenue: number
            buyouts: number
        }= {
            cost: 0,
            orders: 0,
            returns: 0,
            revenue: 0,
            buyouts: 0
        }

        item.orders.forEach((order, index) => {
            const returns = item.returns?.[index] ?? 0
            const cost = item.cost?.[index] ?? 0
            const value = (order - returns) * cost

            /**
             * Я тут не очень понял. в чем разница между revenue and buyouts
             * это же одно и то же, разве нет?
             */
            revenue.push(value)
            buyouts.push(value)


        })
        const costSumm = (item.cost?.reduce((acc, cur) => acc + cur, 0))?? 0
        const orderSumm = (item.orders?.reduce((acc, cur) => acc + cur, 0))?? 0
        const returnSumm = (item.returns?.reduce((acc, cur) => acc + cur, 0))?? 0
        const revenueSumm = revenue.reduce((acc, cur) => acc + cur, 0)
        const buyoutsSumm = buyouts.reduce((acc, cur) => acc + cur, 0)
         const length = item.cost?.length ?? 1
        average.cost = costSumm/length
        average.orders = orderSumm/length
        average.returns = returnSumm/length
        average.revenue = revenueSumm/length
        average.buyouts = buyoutsSumm/length
        sums.cost = costSumm
        sums.orders = orderSumm
        sums.returns = returnSumm
        sums.revenue = revenueSumm
        sums.buyouts = buyoutsSumm


        item.revenue = revenue
        item.buyouts = buyouts
        item.average= average
        item.sums = sums
    })

    self.postMessage(items)
}


