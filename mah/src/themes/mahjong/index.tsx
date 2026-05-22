import { Theme } from '../interface';
import React from 'react';
import { DefaultSoundNames } from '../default';

// 麻将牌 SVG 组件
const MahjongTile: React.FC<{ type: string; value: number }> = ({ type, value }) => {
    const getColor = () => {
        switch (type) {
            case '万': return '#c41e3a'; // 红色
            case '条': return '#2e8b57'; // 绿色
            case '筒': return '#1e90ff'; // 蓝色
            default: return '#333';
        }
    };
    
    const getSymbol = () => {
        if (type === '筒') {
            // 简化的筒子图案
            return (
                <g>
                    {Array.from({ length: value }).map((_, i) => {
                        const row = Math.floor(i / 3);
                        const col = i % 3;
                        return (
                            <circle
                                key={i}
                                cx={20 + col * 20}
                                cy={25 + row * 20}
                                r="8"
                                fill={getColor()}
                            />
                        );
                    })}
                </g>
            );
        }
        if (type === '条') {
            // 简化的条子图案
            return (
                <g>
                    {Array.from({ length: value }).map((_, i) => (
                        <rect
                            key={i}
                            x={10 + (i % 3) * 25}
                            y={15 + Math.floor(i / 3) * 25}
                            width="20"
                            height="3"
                            fill={getColor()}
                        />
                    ))}
                </g>
            );
        }
        // 万子
        return (
            <text
                x="50%"
                y="50%"
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="24"
                fontWeight="bold"
                fill={getColor()}
            >
                {value}{type}
            </text>
        );
    };
    
    return (
        <svg viewBox="0 0 60 80" style={{ width: '100%', height: '100%' }}>
            {/* 麻将牌背景 */}
            <rect
                x="2"
                y="2"
                width="56"
                height="76"
                rx="4"
                fill="#f5f5dc"
                stroke="#333"
                strokeWidth="1"
            />
            {/* 牌面 */}
            {getSymbol()}
        </svg>
    );
};

// 麻将牌配置：万子、条子、筒子各选几个
const mahjongTypes = [
    { type: '万', values: [1, 2, 3, 4, 5] },
    { type: '条', values: [1, 2, 3] },
    { type: '筒', values: [1, 2] },
];

const icons = mahjongTypes.flatMap(({ type, values }) =>
    values.map((value) => ({
        name: `${value}${type}`,
        content: <MahjongTile type={type} value={value} />,
    }))
);

export const mahjongTheme: Theme<DefaultSoundNames> = {
    title: '麻将消消乐',
    desc: '经典麻将牌三消游戏',
    dark: true,
    maxLevel: 20,
    backgroundColor: '#1a3a1a', // 麻将桌绿色背景
    icons: icons.map(({ name, content }) => ({
        name,
        content,
        clickSound: 'button-click',
        tripleSound: 'triple',
    })),
    sounds: [
        {
            name: 'button-click',
            src: '/sound-button-click.mp3',
        },
        {
            name: 'triple',
            src: '/sound-triple.mp3',
        },
    ],
};