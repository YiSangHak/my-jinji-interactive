import {traceRGBA} from './trace.js';
self.onmessage=({data})=>{try{self.postMessage({id:data.id,...traceRGBA(data.pixels,data.width,data.height,data.options)});}catch(error){self.postMessage({id:data.id,error:error.message});}};
