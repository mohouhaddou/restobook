import{f as r,A as s}from"./index-MRFS8tK2.js";/**
 * @license lucide-react v1.24.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const h=[["path",{d:"M12 2v4",key:"3427ic"}],["path",{d:"m16.2 7.8 2.9-2.9",key:"r700ao"}],["path",{d:"M18 12h4",key:"wj9ykh"}],["path",{d:"m16.2 16.2 2.9 2.9",key:"1bxg5t"}],["path",{d:"M12 18v4",key:"jadmvz"}],["path",{d:"m4.9 19.1 2.9-2.9",key:"bwix9q"}],["path",{d:"M2 12h4",key:"j09sii"}],["path",{d:"m4.9 4.9 2.9 2.9",key:"giyufr"}]],m=r("loader",h);async function k(d,i){var a;const o=await fetch(s(`/digital-products/${d}/download`),{headers:{Authorization:`Bearer ${i}`}});if(!o.ok)throw new Error(`HTTP ${o.status}`);const n=await o.blob(),c=((a=(o.headers.get("Content-Disposition")||"").match(/filename="([^"]+)"/))==null?void 0:a[1])||"download",t=URL.createObjectURL(n),e=document.createElement("a");e.href=t,e.download=c,document.body.appendChild(e),e.click(),e.remove(),URL.revokeObjectURL(t)}export{m as L,k as d};
