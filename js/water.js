// A transparent water surface: refracts the rendered scene, never the UI or source SVG.
export function createWater(canvas){
 const gl=canvas.getContext('webgl',{alpha:false,antialias:false});if(!gl)return null;
 const vertex=`attribute vec2 position;varying vec2 uv;void main(){uv=(position+1.)*.5;gl_Position=vec4(position,0.,1.);}`;
 const fragment=`precision highp float;varying vec2 uv;uniform sampler2D scene;uniform vec2 resolution;uniform float density;uniform vec4 waves[16];uniform vec4 touch;
 void main(){vec2 p=vec2(uv.x,1.-uv.y)*resolution;vec2 displacement=vec2(0.);float light=0.;
 // A held finger makes a shallow depression; releasing it leaves expanding waves.
 vec2 deltaTouch=p-touch.xy;float radius=76.*density;float distanceTouch=length(deltaTouch);
 float bowl=exp(-distanceTouch*distanceTouch/(radius*radius));
 displacement+=deltaTouch/max(distanceTouch,1.)*(distanceTouch/radius)*bowl*touch.z*11.*density;
 light+=touch.z*bowl*(distanceTouch/radius-.55)*.022;
 for(int i=0;i<16;i++){vec4 w=waves[i];float age=w.z;if(age<0.)continue;
 vec2 delta=p-w.xy;float d=length(delta);float front=d-age*190.*density;
 float envelope=exp(-front*front/(1000.*density*density))*exp(-age*1.7)*w.w;
 float phase=front*.075/density;vec2 dir=delta/max(d,1.);
 displacement+=dir*sin(phase)*envelope*4.*density;light+=cos(phase)*envelope*.014;}
 float magnitude=length(displacement);displacement*=min(1.,20.*density/max(magnitude,.001));
 vec2 at=clamp((p+displacement)/resolution,vec2(.001),vec2(.999));vec3 color=texture2D(scene,at).rgb;gl_FragColor=vec4(color+light,1.);}`;
 function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
 const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))return null;gl.useProgram(program);
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
 const loc=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
 const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 const res=gl.getUniformLocation(program,'resolution'),wave=gl.getUniformLocation(program,'waves[0]'),density=gl.getUniformLocation(program,'density'),touch=gl.getUniformLocation(program,'touch');
 return {draw(source,ripples,ratio=1,contact={x:0,y:0,pressure:0}){if(canvas.width!==source.width||canvas.height!==source.height){canvas.width=source.width;canvas.height=source.height;gl.viewport(0,0,canvas.width,canvas.height);}const data=new Float32Array(64);for(let i=0;i<16;i++){const r=ripples[i];data.set(r?[r.x*ratio,r.y*ratio,r.age,r.power]:[0,0,-1,0],i*4);}gl.uniform4f(touch,contact.x*ratio,contact.y*ratio,contact.pressure,0);gl.uniform1f(density,ratio);gl.uniform2f(res,source.width,source.height);gl.uniform4fv(wave,data);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);gl.drawArrays(gl.TRIANGLES,0,6);}};
}
