// adapted from here: https://stackoverflow.com/questions/5678432/decompressing-half-precision-floats-in-javascript

function float16_to_float(h) {
    var s = (h & 0x8000) >> 15;
    var e = (h & 0x7C00) >> 10;
    var f = h & 0x03FF;

    if(e == 0) {
        return (s?-1:1) * Math.pow(2,-14) * (f/Math.pow(2, 10));
    } else if (e == 0x1F) {
        return f?NaN:((s?-1:1)*Infinity);
    }

    return (s?-1:1) * Math.pow(2, e-15) * (1+(f/Math.pow(2, 10)));
}

// The other direction adapted from here because I'm too lazy to try and reverse one of these functions:
// https://stackoverflow.com/questions/32633585/how-do-you-convert-to-half-floats-in-javascript

function float_to_float16(f) {
  /* This method is faster than the OpenEXR implementation (very often
   * used, eg. in Ogre), with the additional benefit of rounding, inspired
   * by James Tursa?s half-precision code. */

    var floatView = new Float32Array(1);
    var int32View = new Int32Array(floatView.buffer);

    floatView[0] = f;
    var x = int32View[0];

    var bits = (x >> 16) & 0x8000; /* Get the sign */
    var m = (x >> 12) & 0x07ff; /* Keep one extra bit for rounding */
    var e = (x >> 23) & 0xff; /* Using int is faster here */

    /* If zero, or denormal, or exponent underflows too much for a denormal
     * half, return signed zero. */
    if (e < 103) {
      return bits;
    }

    /* If NaN, return NaN. If Inf or exponent overflow, return Inf. */
    if (e > 142) {
      bits |= 0x7c00;
      /* If exponent was 0xff and one mantissa bit was set, it means NaN,
           * not Inf, so make sure we set one mantissa bit too. */
      bits |= ((e == 255) ? 0 : 1) && (x & 0x007fffff);
      return bits;
    }

    /* If exponent underflows but not too much, return a denormal */
    if (e < 113) {
      m |= 0x0800;
      /* Extra rounding may overflow and set mantissa to 0 and exponent
       * to 1, which is OK. */
      bits |= (m >> (114 - e)) + ((m >> (113 - e)) & 1);
      return bits;
    }

    bits |= ((e - 112) << 10) | (m >> 1);
    /* Extra rounding. An overflow will set mantissa to 0 and increment
     * the exponent, which is OK. */
    bits += m & 1;
    return bits;
  }

function test() {
    // This value is definitely 0%
    var vol_p00 = 0xD1D2;
    // eyeballed averages for 25%, 50%, and 75%
    var vol_p25 = 0xCA00;
    var vol_p50 = 0xC5FD;
    var vol_p75 = 0xC09C;
    // This is somewhere around what the values approach as they near 100%
    var vol_p99 = 0xAD00;
    // This value is definitely 100%
    var vol_p100 = 0x0000;

    float16_to_float(vol_p00); // 1
    float16_to_float(vol_p25); // 1
    float16_to_float(vol_p50); // 1
    float16_to_float(vol_p75); // 1
    float16_to_float(vol_p99); // 1
    float16_to_float(vol_p100); // 1
    float16_to_float(parseInt('C000', 16)); // -2

    float16_to_float(parseInt('7BFF', 16)); // 6.5504 × 10^4 (Maximum half precision)
    float16_to_float(parseInt('3555', 16)); // 0.33325... ≈ 1/3
    // Works with all the test cases on the wikipedia page
}