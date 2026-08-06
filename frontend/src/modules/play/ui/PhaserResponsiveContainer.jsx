import React,{forwardRef}from'react';
const PhaserResponsiveContainer=forwardRef(function PhaserResponsiveContainer({children,label='Zone de jeu interactive'},ref){return <div ref={ref} className="play-phaser-canvas" role="application" aria-label={label} dir="ltr">{children}</div>});
export default PhaserResponsiveContainer;
