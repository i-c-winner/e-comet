import { IStatItem } from '../types/stats.types'

self.onmessage = (event: MessageEvent<IStatItem[]>) => {
    const items = event.data

    items.forEach((item) => {
        const revenue: number[] = []
        const buyouts: number[] = []

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

        item.revenue = revenue
        item.buyouts = buyouts
    })

    self.postMessage(items)
}


