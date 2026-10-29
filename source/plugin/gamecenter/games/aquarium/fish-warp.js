/* Author: GPT / Codex, 2026-10-30. Original plugin (C) 2026 Carinoasd.
 * Pure single-texture inverse mapping, shared by offline export and tests.
 * No layered tail image, no generated/redrawn face, no runtime dependency.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AquariumFishWarp = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var defaults = { hinge: 0.36, pivotY: 0.50, amplitude: 0.040,
    finAmplitude: 0.006, finStart: 0.26, headLock: 0.70 };

  function smooth(x) { x = Math.max(0, Math.min(1, x)); return x*x*(3-2*x); }
  function config(options) {
    var c = {}, key;
    for (key in defaults) c[key] = options && options[key] !== undefined ? options[key] : defaults[key];
    for (key in c) if (!Number.isFinite(c[key])) throw new TypeError('Invalid fish warp: '+key);
    if (!(c.hinge > 0 && c.hinge < c.headLock && c.headLock < 1 &&
          c.pivotY > 0 && c.pivotY < 1 && c.amplitude >= 0 && c.amplitude <= 0.06 &&
          c.finAmplitude >= 0 && c.finAmplitude <= 0.009 &&
          c.finStart >= 0 && c.finStart < c.headLock)) throw new RangeError('Unsafe fish warp');
    return c;
  }

  function column(x, width, height, phase, c) {
    var u=x/width, t=Math.max(0,Math.min(1,(c.hinge-u)/c.hinge));
    var weight=smooth(t), sin=Math.sin(phase), sin2=Math.sin(phase*2);
    var shift=height*c.amplitude*weight*(sin*Math.cos(t*.7)+.22*sin2*Math.sin(t*.7));
    var scale=1+.055*weight*sin2;
    var fin=0;
    if (u>c.finStart && u<c.headLock) {
      fin=Math.pow(Math.sin(Math.PI*(u-c.finStart)/(c.headLock-c.finStart)),2);
    }
    return { shift:shift, scale:scale, fin:fin*height*c.finAmplitude*sin,
      pivot:c.pivotY*height, height:height };
  }

  function sourceY(y, col) {
    var base=col.pivot+(y-col.pivot-col.shift)/col.scale;
    var distance=(y-col.pivot)/col.height;
    var fin=smooth((Math.abs(distance)-.13)/.25);
    return base-col.fin*fin*(distance<0?-1:1);
  }

  function frame(input, width, height, phase, options) {
    if (!(Number.isInteger(width) && width>0 && Number.isInteger(height) && height>0 &&
          input && input.length===width*height*4 && Number.isFinite(phase))) {
      throw new TypeError('Invalid fish frame');
    }
    var c=config(options), output=new Uint8ClampedArray(input.length);
    // The neutral frame is an exact copy. No resampling of its head or tail.
    if (Math.abs(Math.sin(phase))<1e-12 && Math.abs(Math.sin(phase*2))<1e-12) {
      output.set(input); return output;
    }
    for (var x=0;x<width;x++) {
      var col=column(x,width,height,phase,c);
      for (var y=0;y<height;y++) {
        var at=(y*width+x)*4;
        if (x/width>=c.headLock) {
          output[at]=input[at];output[at+1]=input[at+1];
          output[at+2]=input[at+2];output[at+3]=input[at+3];continue;
        }
        var sy=sourceY(y,col), y0=Math.floor(sy), v=sy-y0;
        var a0=(y0>=0 && y0<height)?input[(y0*width+x)*4+3]:0;
        var a1=(y0+1>=0 && y0+1<height)?input[((y0+1)*width+x)*4+3]:0;
        var alpha=a0*(1-v)+a1*v;
        if (alpha<=0) continue;
        // Interpolate premultiplied colors to avoid dark transparent-edge halos.
        for(var k=0;k<3;k++) {
          var p0=a0?input[(y0*width+x)*4+k]:0;
          var p1=a1?input[((y0+1)*width+x)*4+k]:0;
          output[at+k]=Math.round((p0*a0*(1-v)+p1*a1*v)/alpha);
        }
        output[at+3]=Math.round(alpha);
      }
    }
    return output;
  }
  return { config:config, column:column, sourceY:sourceY, frame:frame };
}));
