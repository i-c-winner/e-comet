import { IRowNode } from 'ag-grid-enterprise';
import { IStatItem, ORDERED_LEVELS, Levels } from '../types/stats.types';

interface LevelPathConfig {
    showFullHierarchy?: boolean;
    includeLevelNames?: boolean;
}

export function generateLevelPath(node: IRowNode<IStatItem> | null, config: LevelPathConfig = {}): string[] {
    if (!node) {
        return ['Неизвестный путь'];
    }

    const { showFullHierarchy = false, includeLevelNames = false } = config;

    return showFullHierarchy ? generateFullHierarchyPath(node, includeLevelNames) : generateHierarchyPathToNode(node, includeLevelNames);
}

/**
 * Путь до текущего узла (через parent)
 */
function generateHierarchyPathToNode(node: IRowNode<IStatItem>, includeLevelNames: boolean): string[] {
    const pathParts: string[] = [];
    let currentNode: IRowNode<IStatItem> | null = node;

    const hierarchyNodes: IRowNode<IStatItem>[] = [];

    while (currentNode && currentNode.level >= 0) {
        hierarchyNodes.unshift(currentNode);
        currentNode = currentNode.parent;
    }

    hierarchyNodes.forEach((node, index) => {
        let part: string;

        if (node.group) {
            part = String(node.key ?? 'Неизвестно');
        } else if (node.data) {
            part = node.data.article || 'Неизвестно';
        } else {
            part = 'Неизвестно';
        }

        if (includeLevelNames && index < ORDERED_LEVELS.length) {
            const levelName = ORDERED_LEVELS[index];
            part = `${Levels[levelName]}: ${part}`;
        }

        pathParts.push(part);
    });

    return pathParts;
}

/**
 * Полный путь из данных (supplier → brand → type → article)
 */
function generateFullHierarchyPath(node: IRowNode<IStatItem>, includeLevelNames: boolean): string[] {
    if (!node.data) {
        return generateHierarchyPathToNode(node, includeLevelNames);
    }

    const data = node.data;
    const pathParts: string[] = [];

    const hierarchyValues = [data.supplier, data.brand, data.type, data.article];

    hierarchyValues.forEach((value, index) => {
        if (index < ORDERED_LEVELS.length) {
            let part = value || 'Неизвестно';

            if (includeLevelNames) {
                const levelName = ORDERED_LEVELS[index];
                part = `${Levels[levelName]}: ${part}`;
            }

            pathParts.push(part);
        }
    });

    return pathParts;
}
