import React from 'react';
export default function ResponsiveGameContainer({children,className='',variant='default'}){return <div className={`play-ui-responsive ${variant} ${className}`}><div className="play-ui-responsive-inner">{children}</div></div>}
