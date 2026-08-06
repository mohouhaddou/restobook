import React from 'react';
export default function PlayButton({variant='primary',loading=false,icon:Icon,children,className='',...props}){return <button className={`play-ui-button ${variant} ${className}`} disabled={loading||props.disabled} {...props}>{loading?<span className="play-ui-button-loader"/>:Icon&&<Icon size={20} aria-hidden="true"/>}<span>{children}</span></button>}
