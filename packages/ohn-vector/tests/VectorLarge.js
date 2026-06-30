"use strict";

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function _defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, _toPropertyKey(o.key), o); } }
function _createClass(e, r, t) { return r && _defineProperties(e.prototype, r), t && _defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
// Auto-generated Ohnrscript Schema from vector-large.json
var VectorLarge = /*#__PURE__*/function () {
  function VectorLarge(measurements) {
    _classCallCheck(this, VectorLarge);
    this.measurements = measurements;
  }
  return _createClass(VectorLarge, [{
    key: "toCBOR",
    value: function toCBOR() {
      var _size = 0;
      _size += 1;
      _size += 13;
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
      return buf;
    }
  }], [{
    key: "fromCBOR",
    value: function fromCBOR(buf) {
      var _offset = 0;
      var obj = new this();
      _offset++;
      _offset += 13;
      return obj;
    }
  }]);
}();
module.exports = VectorLarge;