"use strict";

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function _defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, _toPropertyKey(o.key), o); } }
function _createClass(e, r, t) { return r && _defineProperties(e.prototype, r), t && _defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
// Auto-generated Ohnrscript Schema from vector.json
var Vector = /*#__PURE__*/function () {
  function Vector(measurements) {
    _classCallCheck(this, Vector);
    this.measurements = measurements;
  }
  return _createClass(Vector, [{
    key: "toCBOR",
    value: function toCBOR() {
      var _size = 0;
      _size += 1;
      _size += 13;
      var arrLen_measurements = this.measurements.length;
      if (arrLen_measurements < 24) {
        _size += 1;
      } else if (arrLen_measurements <= 0xff) {
        _size += 2;
      } else if (arrLen_measurements <= 0xffff) {
        _size += 3;
      } else {
        _size += 5;
      }
      _size += arrLen_measurements * 5;
      var buf = new Uint8Array(_size);
      var _offset = 0;
      buf[_offset++] = 161;
      buf[_offset++] = 108;
      buf[_offset++] = 109;
      buf[_offset++] = 101;
      buf[_offset++] = 97;
      buf[_offset++] = 115;
      buf[_offset++] = 117;
      buf[_offset++] = 114;
      buf[_offset++] = 101;
      buf[_offset++] = 109;
      buf[_offset++] = 101;
      buf[_offset++] = 110;
      buf[_offset++] = 116;
      buf[_offset++] = 115;
      if (arrLen_measurements < 24) {
        buf[_offset++] = 0x80 + arrLen_measurements;
      } else if (arrLen_measurements <= 0xff) {
        buf[_offset++] = 0x98;
        buf[_offset++] = arrLen_measurements;
      } else if (arrLen_measurements <= 0xffff) {
        buf[_offset++] = 0x99;
        buf[_offset++] = arrLen_measurements >>> 8 & 0xff;
        buf[_offset++] = arrLen_measurements & 0xff;
      } else {
        buf[_offset++] = 0x9a;
        buf[_offset++] = arrLen_measurements >>> 24 & 0xff;
        buf[_offset++] = arrLen_measurements >>> 16 & 0xff;
        buf[_offset++] = arrLen_measurements >>> 8 & 0xff;
        buf[_offset++] = arrLen_measurements & 0xff;
      }
      for (var _i = 0; _i < arrLen_measurements; _i++) {
        var elem = this.measurements[_i];
        if (elem >= 0) {
          buf[_offset++] = 0x1a;
          buf[_offset++] = elem >>> 24 & 0xff;
          buf[_offset++] = elem >>> 16 & 0xff;
          buf[_offset++] = elem >>> 8 & 0xff;
          buf[_offset++] = elem & 0xff;
        } else {
          buf[_offset++] = 0x3a;
          var val_elem = -elem - 1;
          buf[_offset++] = val_elem >>> 24 & 0xff;
          buf[_offset++] = val_elem >>> 16 & 0xff;
          buf[_offset++] = val_elem >>> 8 & 0xff;
          buf[_offset++] = val_elem & 0xff;
        }
      }
      return buf;
    }
  }], [{
    key: "fromCBOR",
    value: function fromCBOR(buf) {
      var _offset = 0;
      var obj = new this();
      _offset++;
      _offset += 13;
      var arrTag_measurements = buf[_offset++];
      var arrLen_measurements = 0;
      if (arrTag_measurements >= 0x80 && arrTag_measurements < 0x98) {
        arrLen_measurements = arrTag_measurements - 0x80;
      } else if (arrTag_measurements === 0x98) {
        arrLen_measurements = buf[_offset++];
      } else if (arrTag_measurements === 0x99) {
        arrLen_measurements = buf[_offset++] << 8 | buf[_offset++];
      } else if (arrTag_measurements === 0x9a) {
        arrLen_measurements = (buf[_offset++] << 24 | buf[_offset++] << 16 | buf[_offset++] << 8 | buf[_offset++]) >>> 0;
      } else {
        throw new Error("Validation Error: Expected array for property measurements");
      }
      var arr_measurements = new Array(arrLen_measurements);
      for (var _i = 0; _i < arrLen_measurements; _i++) {
        var tag_elem = buf[_offset++];
        var val_elem = void 0;
        if (tag_elem === 0x1a) {
          val_elem = (buf[_offset++] << 24 | buf[_offset++] << 16 | buf[_offset++] << 8 | buf[_offset++]) >>> 0;
        } else if (tag_elem === 0x3a) {
          var uval = (buf[_offset++] << 24 | buf[_offset++] << 16 | buf[_offset++] << 8 | buf[_offset++]) >>> 0;
          val_elem = -uval - 1;
        } else {
          throw new Error("Validation Error: Expected 32-bit integer for array element in measurements");
        }
        arr_measurements[_i] = val_elem;
      }
      obj.measurements = arr_measurements;
      return obj;
    }
  }]);
}();
module.exports = Vector;