/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-mixed-operators, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars, default-case, jsdoc/require-param*/
"use strict";

var $protobuf = require("protobufjs/minimal");

// Common aliases
var $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;
var $Object = $util.global.Object, $undefined = $util.global.undefined, $Error = $util.global.Error, $TypeError = $util.global.TypeError, $Number = $util.global.Number, $String = $util.global.String, $parseInt = $util.global.parseInt, $BigInt = $util.global.BigInt;

// Exported root namespace
var $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

$root.RegistrationPayload = (function() {

    /**
     * Properties of a RegistrationPayload.
     * @typedef {Object} RegistrationPayload.$Properties
     * @property {number|null} [_v] RegistrationPayload _v
     * @property {string|null} [_t] RegistrationPayload _t
     * @property {string|null} [title] RegistrationPayload title
     * @property {string|null} [artist] RegistrationPayload artist
     * @property {number|null} [durationMs] RegistrationPayload durationMs
     * @property {string|null} [isrc] RegistrationPayload isrc
     * @property {string|null} [upc] RegistrationPayload upc
     * @property {string|null} [pLine] RegistrationPayload pLine
     * @property {string|null} [cLine] RegistrationPayload cLine
     * @property {string|null} [primaryGenre] RegistrationPayload primaryGenre
     * @property {string|null} [secondaryGenre] RegistrationPayload secondaryGenre
     * @property {string|null} [language] RegistrationPayload language
     * @property {number|null} [bitrate] RegistrationPayload bitrate
     * @property {number|null} [sampleRate] RegistrationPayload sampleRate
     * @property {number|null} [channels] RegistrationPayload channels
     * @property {string|null} [format] RegistrationPayload format
     * @property {string|null} [albumTitle] RegistrationPayload albumTitle
     * @property {number|null} [trackNumber] RegistrationPayload trackNumber
     * @property {string|null} [releaseDate] RegistrationPayload releaseDate
     * @property {string|null} [originalReleaseDate] RegistrationPayload originalReleaseDate
     * @property {string|null} [label] RegistrationPayload label
     * @property {string|null} [catalogNumber] RegistrationPayload catalogNumber
     * @property {string|null} [version] RegistrationPayload version
     * @property {string|null} [parentalAdvisory] RegistrationPayload parentalAdvisory
     * @property {string|null} [featuredArtists] RegistrationPayload featuredArtists
     * @property {string|null} [composers] RegistrationPayload composers
     * @property {string|null} [lyricists] RegistrationPayload lyricists
     * @property {string|null} [writers] RegistrationPayload writers
     * @property {string|null} [producers] RegistrationPayload producers
     * @property {string|null} [remixer] RegistrationPayload remixer
     * @property {string|null} [recordingLocation] RegistrationPayload recordingLocation
     * @property {number|null} [recordingYear] RegistrationPayload recordingYear
     * @property {string|null} [iswc] RegistrationPayload iswc
     * @property {string|null} [territories] RegistrationPayload territories
     * @property {number|null} [previewStartMs] RegistrationPayload previewStartMs
     * @property {string|null} [ownerId] RegistrationPayload ownerId
     * @property {string|null} [originPlatform] RegistrationPayload originPlatform
     * @property {number|Long|null} [originTimestamp] RegistrationPayload originTimestamp
     * @property {string|null} [fingerprintHash] RegistrationPayload fingerprintHash
     * @property {string|null} [fingerprintRaw] RegistrationPayload fingerprintRaw
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */

    /**
     * Properties of a RegistrationPayload.
     * @exports IRegistrationPayload
     * @interface IRegistrationPayload
     * @augments RegistrationPayload.$Properties
     * @deprecated Use RegistrationPayload.$Properties instead.
     */

    /**
     * Shape of a RegistrationPayload.
     * @typedef {RegistrationPayload.$Properties} RegistrationPayload.$Shape
     */

    /**
     * Constructs a new RegistrationPayload.
     * @exports RegistrationPayload
     * @classdesc Represents a RegistrationPayload.
     * @constructor
     * @param {RegistrationPayload.$Properties=} [properties] Properties to set
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */
    var RegistrationPayload = function (properties) {
        if (properties)
            for (var keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null && keys[i] !== "__proto__")
                    this[keys[i]] = properties[keys[i]];
    };

    /**
     * RegistrationPayload _v.
     * @member {number} _v
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype._v = 0;

    /**
     * RegistrationPayload _t.
     * @member {string} _t
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype._t = "";

    /**
     * RegistrationPayload title.
     * @member {string} title
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.title = "";

    /**
     * RegistrationPayload artist.
     * @member {string} artist
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.artist = "";

    /**
     * RegistrationPayload durationMs.
     * @member {number} durationMs
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.durationMs = 0;

    /**
     * RegistrationPayload isrc.
     * @member {string} isrc
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.isrc = "";

    /**
     * RegistrationPayload upc.
     * @member {string} upc
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.upc = "";

    /**
     * RegistrationPayload pLine.
     * @member {string} pLine
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.pLine = "";

    /**
     * RegistrationPayload cLine.
     * @member {string} cLine
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.cLine = "";

    /**
     * RegistrationPayload primaryGenre.
     * @member {string} primaryGenre
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.primaryGenre = "";

    /**
     * RegistrationPayload secondaryGenre.
     * @member {string} secondaryGenre
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.secondaryGenre = "";

    /**
     * RegistrationPayload language.
     * @member {string} language
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.language = "";

    /**
     * RegistrationPayload bitrate.
     * @member {number} bitrate
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.bitrate = 0;

    /**
     * RegistrationPayload sampleRate.
     * @member {number} sampleRate
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.sampleRate = 0;

    /**
     * RegistrationPayload channels.
     * @member {number} channels
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.channels = 0;

    /**
     * RegistrationPayload format.
     * @member {string} format
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.format = "";

    /**
     * RegistrationPayload albumTitle.
     * @member {string} albumTitle
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.albumTitle = "";

    /**
     * RegistrationPayload trackNumber.
     * @member {number} trackNumber
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.trackNumber = 0;

    /**
     * RegistrationPayload releaseDate.
     * @member {string} releaseDate
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.releaseDate = "";

    /**
     * RegistrationPayload originalReleaseDate.
     * @member {string} originalReleaseDate
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.originalReleaseDate = "";

    /**
     * RegistrationPayload label.
     * @member {string} label
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.label = "";

    /**
     * RegistrationPayload catalogNumber.
     * @member {string} catalogNumber
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.catalogNumber = "";

    /**
     * RegistrationPayload version.
     * @member {string} version
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.version = "";

    /**
     * RegistrationPayload parentalAdvisory.
     * @member {string} parentalAdvisory
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.parentalAdvisory = "";

    /**
     * RegistrationPayload featuredArtists.
     * @member {string} featuredArtists
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.featuredArtists = "";

    /**
     * RegistrationPayload composers.
     * @member {string} composers
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.composers = "";

    /**
     * RegistrationPayload lyricists.
     * @member {string} lyricists
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.lyricists = "";

    /**
     * RegistrationPayload writers.
     * @member {string} writers
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.writers = "";

    /**
     * RegistrationPayload producers.
     * @member {string} producers
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.producers = "";

    /**
     * RegistrationPayload remixer.
     * @member {string} remixer
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.remixer = "";

    /**
     * RegistrationPayload recordingLocation.
     * @member {string} recordingLocation
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.recordingLocation = "";

    /**
     * RegistrationPayload recordingYear.
     * @member {number} recordingYear
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.recordingYear = 0;

    /**
     * RegistrationPayload iswc.
     * @member {string} iswc
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.iswc = "";

    /**
     * RegistrationPayload territories.
     * @member {string} territories
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.territories = "";

    /**
     * RegistrationPayload previewStartMs.
     * @member {number} previewStartMs
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.previewStartMs = 0;

    /**
     * RegistrationPayload ownerId.
     * @member {string} ownerId
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.ownerId = "";

    /**
     * RegistrationPayload originPlatform.
     * @member {string} originPlatform
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.originPlatform = "";

    /**
     * RegistrationPayload originTimestamp.
     * @member {number|Long} originTimestamp
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.originTimestamp = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

    /**
     * RegistrationPayload fingerprintHash.
     * @member {string} fingerprintHash
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.fingerprintHash = "";

    /**
     * RegistrationPayload fingerprintRaw.
     * @member {string} fingerprintRaw
     * @memberof RegistrationPayload
     * @instance
     */
    RegistrationPayload.prototype.fingerprintRaw = "";

    /**
     * Creates a new RegistrationPayload instance using the specified properties.
     * @function create
     * @memberof RegistrationPayload
     * @static
     * @param {RegistrationPayload.$Properties=} [properties] Properties to set
     * @returns {RegistrationPayload} RegistrationPayload instance
     * @type {{
     *   (properties: RegistrationPayload.$Shape): RegistrationPayload & RegistrationPayload.$Shape;
     *   (properties?: RegistrationPayload.$Properties): RegistrationPayload;
     * }}
     */
    RegistrationPayload.create = function(properties) {
        return new RegistrationPayload(properties);
    };

    /**
     * Encodes the specified RegistrationPayload message. Does not implicitly {@link RegistrationPayload.verify|verify} messages.
     * @function encode
     * @memberof RegistrationPayload
     * @static
     * @param {RegistrationPayload.$Properties} message RegistrationPayload message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RegistrationPayload.encode = function (message, writer, _depth) {
        if (!writer)
            writer = $Writer.create();
        if (_depth === $undefined)
            _depth = 0;
        if (_depth > $util.recursionLimit)
            throw $Error("max depth exceeded");
        if (message._v != null && $Object.hasOwnProperty.call(message, "_v") && message._v !== 0)
            writer.uint32(/* id 1, wireType 0 =*/8).int32(message._v);
        if (message._t != null && $Object.hasOwnProperty.call(message, "_t") && message._t !== "")
            writer.uint32(/* id 2, wireType 2 =*/18).string(message._t);
        if (message.title != null && $Object.hasOwnProperty.call(message, "title") && message.title !== "")
            writer.uint32(/* id 3, wireType 2 =*/26).string(message.title);
        if (message.artist != null && $Object.hasOwnProperty.call(message, "artist") && message.artist !== "")
            writer.uint32(/* id 4, wireType 2 =*/34).string(message.artist);
        if (message.durationMs != null && $Object.hasOwnProperty.call(message, "durationMs") && message.durationMs !== 0)
            writer.uint32(/* id 5, wireType 0 =*/40).int32(message.durationMs);
        if (message.isrc != null && $Object.hasOwnProperty.call(message, "isrc") && message.isrc !== "")
            writer.uint32(/* id 6, wireType 2 =*/50).string(message.isrc);
        if (message.upc != null && $Object.hasOwnProperty.call(message, "upc") && message.upc !== "")
            writer.uint32(/* id 7, wireType 2 =*/58).string(message.upc);
        if (message.pLine != null && $Object.hasOwnProperty.call(message, "pLine") && message.pLine !== "")
            writer.uint32(/* id 8, wireType 2 =*/66).string(message.pLine);
        if (message.cLine != null && $Object.hasOwnProperty.call(message, "cLine") && message.cLine !== "")
            writer.uint32(/* id 9, wireType 2 =*/74).string(message.cLine);
        if (message.primaryGenre != null && $Object.hasOwnProperty.call(message, "primaryGenre") && message.primaryGenre !== "")
            writer.uint32(/* id 10, wireType 2 =*/82).string(message.primaryGenre);
        if (message.secondaryGenre != null && $Object.hasOwnProperty.call(message, "secondaryGenre") && message.secondaryGenre !== "")
            writer.uint32(/* id 11, wireType 2 =*/90).string(message.secondaryGenre);
        if (message.language != null && $Object.hasOwnProperty.call(message, "language") && message.language !== "")
            writer.uint32(/* id 12, wireType 2 =*/98).string(message.language);
        if (message.bitrate != null && $Object.hasOwnProperty.call(message, "bitrate") && message.bitrate !== 0)
            writer.uint32(/* id 13, wireType 0 =*/104).int32(message.bitrate);
        if (message.sampleRate != null && $Object.hasOwnProperty.call(message, "sampleRate") && message.sampleRate !== 0)
            writer.uint32(/* id 14, wireType 0 =*/112).int32(message.sampleRate);
        if (message.channels != null && $Object.hasOwnProperty.call(message, "channels") && message.channels !== 0)
            writer.uint32(/* id 15, wireType 0 =*/120).int32(message.channels);
        if (message.format != null && $Object.hasOwnProperty.call(message, "format") && message.format !== "")
            writer.uint32(/* id 16, wireType 2 =*/130).string(message.format);
        if (message.albumTitle != null && $Object.hasOwnProperty.call(message, "albumTitle") && message.albumTitle !== "")
            writer.uint32(/* id 17, wireType 2 =*/138).string(message.albumTitle);
        if (message.trackNumber != null && $Object.hasOwnProperty.call(message, "trackNumber") && message.trackNumber !== 0)
            writer.uint32(/* id 18, wireType 0 =*/144).int32(message.trackNumber);
        if (message.releaseDate != null && $Object.hasOwnProperty.call(message, "releaseDate") && message.releaseDate !== "")
            writer.uint32(/* id 19, wireType 2 =*/154).string(message.releaseDate);
        if (message.originalReleaseDate != null && $Object.hasOwnProperty.call(message, "originalReleaseDate") && message.originalReleaseDate !== "")
            writer.uint32(/* id 20, wireType 2 =*/162).string(message.originalReleaseDate);
        if (message.label != null && $Object.hasOwnProperty.call(message, "label") && message.label !== "")
            writer.uint32(/* id 21, wireType 2 =*/170).string(message.label);
        if (message.catalogNumber != null && $Object.hasOwnProperty.call(message, "catalogNumber") && message.catalogNumber !== "")
            writer.uint32(/* id 22, wireType 2 =*/178).string(message.catalogNumber);
        if (message.version != null && $Object.hasOwnProperty.call(message, "version") && message.version !== "")
            writer.uint32(/* id 23, wireType 2 =*/186).string(message.version);
        if (message.parentalAdvisory != null && $Object.hasOwnProperty.call(message, "parentalAdvisory") && message.parentalAdvisory !== "")
            writer.uint32(/* id 24, wireType 2 =*/194).string(message.parentalAdvisory);
        if (message.featuredArtists != null && $Object.hasOwnProperty.call(message, "featuredArtists") && message.featuredArtists !== "")
            writer.uint32(/* id 25, wireType 2 =*/202).string(message.featuredArtists);
        if (message.composers != null && $Object.hasOwnProperty.call(message, "composers") && message.composers !== "")
            writer.uint32(/* id 26, wireType 2 =*/210).string(message.composers);
        if (message.lyricists != null && $Object.hasOwnProperty.call(message, "lyricists") && message.lyricists !== "")
            writer.uint32(/* id 27, wireType 2 =*/218).string(message.lyricists);
        if (message.writers != null && $Object.hasOwnProperty.call(message, "writers") && message.writers !== "")
            writer.uint32(/* id 28, wireType 2 =*/226).string(message.writers);
        if (message.producers != null && $Object.hasOwnProperty.call(message, "producers") && message.producers !== "")
            writer.uint32(/* id 29, wireType 2 =*/234).string(message.producers);
        if (message.remixer != null && $Object.hasOwnProperty.call(message, "remixer") && message.remixer !== "")
            writer.uint32(/* id 30, wireType 2 =*/242).string(message.remixer);
        if (message.recordingLocation != null && $Object.hasOwnProperty.call(message, "recordingLocation") && message.recordingLocation !== "")
            writer.uint32(/* id 31, wireType 2 =*/250).string(message.recordingLocation);
        if (message.recordingYear != null && $Object.hasOwnProperty.call(message, "recordingYear") && message.recordingYear !== 0)
            writer.uint32(/* id 32, wireType 0 =*/256).int32(message.recordingYear);
        if (message.iswc != null && $Object.hasOwnProperty.call(message, "iswc") && message.iswc !== "")
            writer.uint32(/* id 33, wireType 2 =*/266).string(message.iswc);
        if (message.territories != null && $Object.hasOwnProperty.call(message, "territories") && message.territories !== "")
            writer.uint32(/* id 34, wireType 2 =*/274).string(message.territories);
        if (message.previewStartMs != null && $Object.hasOwnProperty.call(message, "previewStartMs") && message.previewStartMs !== 0)
            writer.uint32(/* id 35, wireType 0 =*/280).int32(message.previewStartMs);
        if (message.ownerId != null && $Object.hasOwnProperty.call(message, "ownerId") && message.ownerId !== "")
            writer.uint32(/* id 36, wireType 2 =*/290).string(message.ownerId);
        if (message.originPlatform != null && $Object.hasOwnProperty.call(message, "originPlatform") && message.originPlatform !== "")
            writer.uint32(/* id 37, wireType 2 =*/298).string(message.originPlatform);
        if (message.originTimestamp != null && $Object.hasOwnProperty.call(message, "originTimestamp") && (typeof message.originTimestamp === "object" ? message.originTimestamp.low || message.originTimestamp.high : message.originTimestamp !== 0))
            writer.uint32(/* id 38, wireType 0 =*/304).int64(message.originTimestamp);
        if (message.fingerprintHash != null && $Object.hasOwnProperty.call(message, "fingerprintHash") && message.fingerprintHash !== "")
            writer.uint32(/* id 39, wireType 2 =*/314).string(message.fingerprintHash);
        if (message.fingerprintRaw != null && $Object.hasOwnProperty.call(message, "fingerprintRaw") && message.fingerprintRaw !== "")
            writer.uint32(/* id 40, wireType 2 =*/322).string(message.fingerprintRaw);
        if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
            for (var i = 0; i < message.$unknowns.length; ++i)
                writer.raw(message.$unknowns[i]);
        return writer;
    };

    /**
     * Encodes the specified RegistrationPayload message, length delimited. Does not implicitly {@link RegistrationPayload.verify|verify} messages.
     * @function encodeDelimited
     * @memberof RegistrationPayload
     * @static
     * @param {RegistrationPayload.$Properties} message RegistrationPayload message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RegistrationPayload.encodeDelimited = function(message, writer) {
        return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
    };

    /**
     * Decodes a RegistrationPayload message from the specified reader or buffer.
     * @function decode
     * @memberof RegistrationPayload
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {RegistrationPayload & RegistrationPayload.$Shape} RegistrationPayload
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RegistrationPayload.decode = function (reader, length, _end, _depth, _target) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        if (_depth === $undefined)
            _depth = 0;
        if (_depth > $Reader.recursionLimit)
            throw $Error("max depth exceeded");
        var end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.RegistrationPayload(), value;
        while (reader.pos < end) {
            var start = reader.pos;
            var tag = reader.tag();
            if (tag === _end) {
                _end = $undefined;
                break;
            }
            var wireType = tag & 7;
            switch (tag >>>= 3) {
            case 1: {
                    if (wireType !== 0)
                        break;
                    if (value = reader.int32())
                        message._v = value;
                    else
                        delete message._v;
                    continue;
                }
            case 2: {
                    if (wireType !== 2)
                        break;
                    if ((value = reader.stringVerify()).length)
                        message._t = value;
                    else
                        delete message._t;
                    continue;
                }
            case 3: {
                    if (wireType !== 2)
                        break;
                    if ((value = reader.stringVerify()).length)
                        message.title = value;
                    else
                        delete message.title;
                    continue;
                }
            case 4: {
                    if (wireType !== 2)
                        break;
                    if ((value = reader.stringVerify()).length)
                        message.artist = value;
                    else
                        delete message.artist;
                    continue;
                }
            case 5: {
                    if (wireType !== 0)
                        break;
                    if (value = reader.int32())
                        message.durationMs = value;
                    else
                        delete message.durationMs;
                    continue;
                }
            case 6: {
                    if (wireType !== 2)
                        break;
                    if ((value = reader.stringVerify()).length)
                        message.isrc = value;
                    else
                        delete message.isrc;
                    continue;
                }
            case 7: {
                    if (wireType !== 2)
                        break;
                    if ((value = reader.stringVerify()).length)
                        message.upc = value;
                    else
                        delete message.upc;
                    continue;
                }
            case 8: {
                    if (wireType !== 2)
                        break;
                    if ((value = reader.stringVerify()).length)
                        message.pLine = value;
                    else
                        delete message.pLine;
                    continue;
                }
            case 9: {
                    if (wireType !== 2)
                        break;
                    if ((value = reader.stringVerify()).length)
                        message.cLine = value;
                    else
                        delete message.cLine;
                    continue;
                }
            case 10: {
                    if (wireType !== 2)
                        break;
                    if ((value = reader.stringVerify()).length)
                        message.primaryGenre = value;
                    else
                        delete message.primaryGenre;
                    continue;
                }
            case 11: {
                    if (wireType !== 2)
                        break;
                    if ((value = reader.stringVerify()).length)
                        message.secondaryGenre = value;
                    else
                        delete message.secondaryGenre;
                    continue;
                }
            case 12: {
                    if (wireType !== 2)
                        break;
                    if ((value = reader.stringVerify()).length)
                        message.language = value;
                    else
                        delete message.language;
                    continue;
                }
            case 13: {
                    if (wireType !== 0)
                        break;
                    if (value = reader.int32())
                        message.bitrate = value;
                    else
                        delete message.bitrate;
                    continue;
                }
            case 14: {
                    if (wireType !== 0)
                        break;
                    if (value = reader.int32())
                        message.sampleRate = value;
                    else
                        delete message.sampleRate;
                    continue;
                }
            case 15: {
                    if (wireType !== 0)
                        break;
                    if (value = reader.int32())
                        message.channels = value;
                    else
                        delete message.channels;
                    continue;
                }
            case 16: {
                    if (wireType !== 2)
                        break;
                    if ((value = reader.stringVerify()).length)
                        message.format = value;
                    else
                        delete message.format;
                    continue;
                }
            case 17: {
                    if (wireType !== 2)
                        break;
                    if ((value = reader.stringVerify()).length)
                        message.albumTitle = value;
                    else
                        delete message.albumTitle;
                    continue;
                }
            case 18: {
                    if (wireType !== 0)
                        break;
                    if (value = reader.int32())
                        message.trackNumber = value;
                    else
                        delete message.trackNumber;
                    continue;
                }
            case 19: {
                    if (wireType !== 2)
                        break;
                    if ((value = reader.stringVerify()).length)
                        message.releaseDate = value;
                    else
                        delete message.releaseDate;
                    continue;
                }
            case 20: {
                    if (wireType !== 2)
                        break;
                    if ((value = reader.stringVerify()).length)
                        message.originalReleaseDate = value;
                    else
                        delete message.originalReleaseDate;
                    continue;
                }
            case 21: {
                    if (wireType !== 2)
                        break;
                    if ((value = reader.stringVerify()).length)
                        message.label = value;
                    else
                        delete message.label;
                    continue;
                }
            case 22: {
                    if (wireType !== 2)
                        break;
                    if ((value = reader.stringVerify()).length)
                        message.catalogNumber = value;
                    else
                        delete message.catalogNumber;
                    continue;
                }
            case 23: {
                    if (wireType !== 2)
                        break;
                    if ((value = reader.stringVerify()).length)
                        message.version = value;
                    else
                        delete message.version;
                    continue;
                }
            case 24: {
                    if (wireType !== 2)
                        break;
                    if ((value = reader.stringVerify()).length)
                        message.parentalAdvisory = value;
                    else
                        delete message.parentalAdvisory;
                    continue;
                }
            case 25: {
                    if (wireType !== 2)
                        break;
                    if ((value = reader.stringVerify()).length)
                        message.featuredArtists = value;
                    else
                        delete message.featuredArtists;
                    continue;
                }
            case 26: {
                    if (wireType !== 2)
                        break;
                    if ((value = reader.stringVerify()).length)
                        message.composers = value;
                    else
                        delete message.composers;
                    continue;
                }
            case 27: {
                    if (wireType !== 2)
                        break;
                    if ((value = reader.stringVerify()).length)
                        message.lyricists = value;
                    else
                        delete message.lyricists;
                    continue;
                }
            case 28: {
                    if (wireType !== 2)
                        break;
                    if ((value = reader.stringVerify()).length)
                        message.writers = value;
                    else
                        delete message.writers;
                    continue;
                }
            case 29: {
                    if (wireType !== 2)
                        break;
                    if ((value = reader.stringVerify()).length)
                        message.producers = value;
                    else
                        delete message.producers;
                    continue;
                }
            case 30: {
                    if (wireType !== 2)
                        break;
                    if ((value = reader.stringVerify()).length)
                        message.remixer = value;
                    else
                        delete message.remixer;
                    continue;
                }
            case 31: {
                    if (wireType !== 2)
                        break;
                    if ((value = reader.stringVerify()).length)
                        message.recordingLocation = value;
                    else
                        delete message.recordingLocation;
                    continue;
                }
            case 32: {
                    if (wireType !== 0)
                        break;
                    if (value = reader.int32())
                        message.recordingYear = value;
                    else
                        delete message.recordingYear;
                    continue;
                }
            case 33: {
                    if (wireType !== 2)
                        break;
                    if ((value = reader.stringVerify()).length)
                        message.iswc = value;
                    else
                        delete message.iswc;
                    continue;
                }
            case 34: {
                    if (wireType !== 2)
                        break;
                    if ((value = reader.stringVerify()).length)
                        message.territories = value;
                    else
                        delete message.territories;
                    continue;
                }
            case 35: {
                    if (wireType !== 0)
                        break;
                    if (value = reader.int32())
                        message.previewStartMs = value;
                    else
                        delete message.previewStartMs;
                    continue;
                }
            case 36: {
                    if (wireType !== 2)
                        break;
                    if ((value = reader.stringVerify()).length)
                        message.ownerId = value;
                    else
                        delete message.ownerId;
                    continue;
                }
            case 37: {
                    if (wireType !== 2)
                        break;
                    if ((value = reader.stringVerify()).length)
                        message.originPlatform = value;
                    else
                        delete message.originPlatform;
                    continue;
                }
            case 38: {
                    if (wireType !== 0)
                        break;
                    if (typeof (value = reader.int64()) === "object" ? value.low || value.high : value !== 0)
                        message.originTimestamp = value;
                    else
                        delete message.originTimestamp;
                    continue;
                }
            case 39: {
                    if (wireType !== 2)
                        break;
                    if ((value = reader.stringVerify()).length)
                        message.fingerprintHash = value;
                    else
                        delete message.fingerprintHash;
                    continue;
                }
            case 40: {
                    if (wireType !== 2)
                        break;
                    if ((value = reader.stringVerify()).length)
                        message.fingerprintRaw = value;
                    else
                        delete message.fingerprintRaw;
                    continue;
                }
            }
            reader.skipType(wireType, _depth, tag);
            if (!reader.discardUnknown) {
                $util.makeProp(message, "$unknowns", false);
                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
            }
        }
        if (_end !== $undefined)
            throw $Error("missing end group");
        return message;
    };

    /**
     * Decodes a RegistrationPayload message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof RegistrationPayload
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {RegistrationPayload & RegistrationPayload.$Shape} RegistrationPayload
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RegistrationPayload.decodeDelimited = function(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RegistrationPayload message.
     * @function verify
     * @memberof RegistrationPayload
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RegistrationPayload.verify = function (message, _depth) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (_depth === $undefined)
            _depth = 0;
        if (_depth > $util.recursionLimit)
            return "max depth exceeded";
        if (message._v != null && $Object.hasOwnProperty.call(message, "_v"))
            if (!$util.isInteger(message._v))
                return "_v: integer expected";
        if (message._t != null && $Object.hasOwnProperty.call(message, "_t"))
            if (!$util.isString(message._t))
                return "_t: string expected";
        if (message.title != null && $Object.hasOwnProperty.call(message, "title"))
            if (!$util.isString(message.title))
                return "title: string expected";
        if (message.artist != null && $Object.hasOwnProperty.call(message, "artist"))
            if (!$util.isString(message.artist))
                return "artist: string expected";
        if (message.durationMs != null && $Object.hasOwnProperty.call(message, "durationMs"))
            if (!$util.isInteger(message.durationMs))
                return "durationMs: integer expected";
        if (message.isrc != null && $Object.hasOwnProperty.call(message, "isrc"))
            if (!$util.isString(message.isrc))
                return "isrc: string expected";
        if (message.upc != null && $Object.hasOwnProperty.call(message, "upc"))
            if (!$util.isString(message.upc))
                return "upc: string expected";
        if (message.pLine != null && $Object.hasOwnProperty.call(message, "pLine"))
            if (!$util.isString(message.pLine))
                return "pLine: string expected";
        if (message.cLine != null && $Object.hasOwnProperty.call(message, "cLine"))
            if (!$util.isString(message.cLine))
                return "cLine: string expected";
        if (message.primaryGenre != null && $Object.hasOwnProperty.call(message, "primaryGenre"))
            if (!$util.isString(message.primaryGenre))
                return "primaryGenre: string expected";
        if (message.secondaryGenre != null && $Object.hasOwnProperty.call(message, "secondaryGenre"))
            if (!$util.isString(message.secondaryGenre))
                return "secondaryGenre: string expected";
        if (message.language != null && $Object.hasOwnProperty.call(message, "language"))
            if (!$util.isString(message.language))
                return "language: string expected";
        if (message.bitrate != null && $Object.hasOwnProperty.call(message, "bitrate"))
            if (!$util.isInteger(message.bitrate))
                return "bitrate: integer expected";
        if (message.sampleRate != null && $Object.hasOwnProperty.call(message, "sampleRate"))
            if (!$util.isInteger(message.sampleRate))
                return "sampleRate: integer expected";
        if (message.channels != null && $Object.hasOwnProperty.call(message, "channels"))
            if (!$util.isInteger(message.channels))
                return "channels: integer expected";
        if (message.format != null && $Object.hasOwnProperty.call(message, "format"))
            if (!$util.isString(message.format))
                return "format: string expected";
        if (message.albumTitle != null && $Object.hasOwnProperty.call(message, "albumTitle"))
            if (!$util.isString(message.albumTitle))
                return "albumTitle: string expected";
        if (message.trackNumber != null && $Object.hasOwnProperty.call(message, "trackNumber"))
            if (!$util.isInteger(message.trackNumber))
                return "trackNumber: integer expected";
        if (message.releaseDate != null && $Object.hasOwnProperty.call(message, "releaseDate"))
            if (!$util.isString(message.releaseDate))
                return "releaseDate: string expected";
        if (message.originalReleaseDate != null && $Object.hasOwnProperty.call(message, "originalReleaseDate"))
            if (!$util.isString(message.originalReleaseDate))
                return "originalReleaseDate: string expected";
        if (message.label != null && $Object.hasOwnProperty.call(message, "label"))
            if (!$util.isString(message.label))
                return "label: string expected";
        if (message.catalogNumber != null && $Object.hasOwnProperty.call(message, "catalogNumber"))
            if (!$util.isString(message.catalogNumber))
                return "catalogNumber: string expected";
        if (message.version != null && $Object.hasOwnProperty.call(message, "version"))
            if (!$util.isString(message.version))
                return "version: string expected";
        if (message.parentalAdvisory != null && $Object.hasOwnProperty.call(message, "parentalAdvisory"))
            if (!$util.isString(message.parentalAdvisory))
                return "parentalAdvisory: string expected";
        if (message.featuredArtists != null && $Object.hasOwnProperty.call(message, "featuredArtists"))
            if (!$util.isString(message.featuredArtists))
                return "featuredArtists: string expected";
        if (message.composers != null && $Object.hasOwnProperty.call(message, "composers"))
            if (!$util.isString(message.composers))
                return "composers: string expected";
        if (message.lyricists != null && $Object.hasOwnProperty.call(message, "lyricists"))
            if (!$util.isString(message.lyricists))
                return "lyricists: string expected";
        if (message.writers != null && $Object.hasOwnProperty.call(message, "writers"))
            if (!$util.isString(message.writers))
                return "writers: string expected";
        if (message.producers != null && $Object.hasOwnProperty.call(message, "producers"))
            if (!$util.isString(message.producers))
                return "producers: string expected";
        if (message.remixer != null && $Object.hasOwnProperty.call(message, "remixer"))
            if (!$util.isString(message.remixer))
                return "remixer: string expected";
        if (message.recordingLocation != null && $Object.hasOwnProperty.call(message, "recordingLocation"))
            if (!$util.isString(message.recordingLocation))
                return "recordingLocation: string expected";
        if (message.recordingYear != null && $Object.hasOwnProperty.call(message, "recordingYear"))
            if (!$util.isInteger(message.recordingYear))
                return "recordingYear: integer expected";
        if (message.iswc != null && $Object.hasOwnProperty.call(message, "iswc"))
            if (!$util.isString(message.iswc))
                return "iswc: string expected";
        if (message.territories != null && $Object.hasOwnProperty.call(message, "territories"))
            if (!$util.isString(message.territories))
                return "territories: string expected";
        if (message.previewStartMs != null && $Object.hasOwnProperty.call(message, "previewStartMs"))
            if (!$util.isInteger(message.previewStartMs))
                return "previewStartMs: integer expected";
        if (message.ownerId != null && $Object.hasOwnProperty.call(message, "ownerId"))
            if (!$util.isString(message.ownerId))
                return "ownerId: string expected";
        if (message.originPlatform != null && $Object.hasOwnProperty.call(message, "originPlatform"))
            if (!$util.isString(message.originPlatform))
                return "originPlatform: string expected";
        if (message.originTimestamp != null && $Object.hasOwnProperty.call(message, "originTimestamp"))
            if (!$util.isInteger(message.originTimestamp) && !(message.originTimestamp && $util.isInteger(message.originTimestamp.low) && $util.isInteger(message.originTimestamp.high)))
                return "originTimestamp: integer|Long expected";
        if (message.fingerprintHash != null && $Object.hasOwnProperty.call(message, "fingerprintHash"))
            if (!$util.isString(message.fingerprintHash))
                return "fingerprintHash: string expected";
        if (message.fingerprintRaw != null && $Object.hasOwnProperty.call(message, "fingerprintRaw"))
            if (!$util.isString(message.fingerprintRaw))
                return "fingerprintRaw: string expected";
        return null;
    };

    /**
     * Creates a RegistrationPayload message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof RegistrationPayload
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {RegistrationPayload} RegistrationPayload
     */
    RegistrationPayload.fromObject = function (object, _depth) {
        if (object instanceof $root.RegistrationPayload)
            return object;
        if (!$util.isObject(object))
            throw $TypeError(".RegistrationPayload: object expected");
        if (_depth === $undefined)
            _depth = 0;
        if (_depth > $util.recursionLimit)
            throw $Error("max depth exceeded");
        var message = new $root.RegistrationPayload();
        if (object._v != null)
            if ($Number(object._v) !== 0)
                message._v = object._v | 0;
        if (object._t != null)
            if (typeof object._t !== "string" || object._t.length)
                message._t = $String(object._t);
        if (object.title != null)
            if (typeof object.title !== "string" || object.title.length)
                message.title = $String(object.title);
        if (object.artist != null)
            if (typeof object.artist !== "string" || object.artist.length)
                message.artist = $String(object.artist);
        if (object.durationMs != null)
            if ($Number(object.durationMs) !== 0)
                message.durationMs = object.durationMs | 0;
        if (object.isrc != null)
            if (typeof object.isrc !== "string" || object.isrc.length)
                message.isrc = $String(object.isrc);
        if (object.upc != null)
            if (typeof object.upc !== "string" || object.upc.length)
                message.upc = $String(object.upc);
        if (object.pLine != null)
            if (typeof object.pLine !== "string" || object.pLine.length)
                message.pLine = $String(object.pLine);
        if (object.cLine != null)
            if (typeof object.cLine !== "string" || object.cLine.length)
                message.cLine = $String(object.cLine);
        if (object.primaryGenre != null)
            if (typeof object.primaryGenre !== "string" || object.primaryGenre.length)
                message.primaryGenre = $String(object.primaryGenre);
        if (object.secondaryGenre != null)
            if (typeof object.secondaryGenre !== "string" || object.secondaryGenre.length)
                message.secondaryGenre = $String(object.secondaryGenre);
        if (object.language != null)
            if (typeof object.language !== "string" || object.language.length)
                message.language = $String(object.language);
        if (object.bitrate != null)
            if ($Number(object.bitrate) !== 0)
                message.bitrate = object.bitrate | 0;
        if (object.sampleRate != null)
            if ($Number(object.sampleRate) !== 0)
                message.sampleRate = object.sampleRate | 0;
        if (object.channels != null)
            if ($Number(object.channels) !== 0)
                message.channels = object.channels | 0;
        if (object.format != null)
            if (typeof object.format !== "string" || object.format.length)
                message.format = $String(object.format);
        if (object.albumTitle != null)
            if (typeof object.albumTitle !== "string" || object.albumTitle.length)
                message.albumTitle = $String(object.albumTitle);
        if (object.trackNumber != null)
            if ($Number(object.trackNumber) !== 0)
                message.trackNumber = object.trackNumber | 0;
        if (object.releaseDate != null)
            if (typeof object.releaseDate !== "string" || object.releaseDate.length)
                message.releaseDate = $String(object.releaseDate);
        if (object.originalReleaseDate != null)
            if (typeof object.originalReleaseDate !== "string" || object.originalReleaseDate.length)
                message.originalReleaseDate = $String(object.originalReleaseDate);
        if (object.label != null)
            if (typeof object.label !== "string" || object.label.length)
                message.label = $String(object.label);
        if (object.catalogNumber != null)
            if (typeof object.catalogNumber !== "string" || object.catalogNumber.length)
                message.catalogNumber = $String(object.catalogNumber);
        if (object.version != null)
            if (typeof object.version !== "string" || object.version.length)
                message.version = $String(object.version);
        if (object.parentalAdvisory != null)
            if (typeof object.parentalAdvisory !== "string" || object.parentalAdvisory.length)
                message.parentalAdvisory = $String(object.parentalAdvisory);
        if (object.featuredArtists != null)
            if (typeof object.featuredArtists !== "string" || object.featuredArtists.length)
                message.featuredArtists = $String(object.featuredArtists);
        if (object.composers != null)
            if (typeof object.composers !== "string" || object.composers.length)
                message.composers = $String(object.composers);
        if (object.lyricists != null)
            if (typeof object.lyricists !== "string" || object.lyricists.length)
                message.lyricists = $String(object.lyricists);
        if (object.writers != null)
            if (typeof object.writers !== "string" || object.writers.length)
                message.writers = $String(object.writers);
        if (object.producers != null)
            if (typeof object.producers !== "string" || object.producers.length)
                message.producers = $String(object.producers);
        if (object.remixer != null)
            if (typeof object.remixer !== "string" || object.remixer.length)
                message.remixer = $String(object.remixer);
        if (object.recordingLocation != null)
            if (typeof object.recordingLocation !== "string" || object.recordingLocation.length)
                message.recordingLocation = $String(object.recordingLocation);
        if (object.recordingYear != null)
            if ($Number(object.recordingYear) !== 0)
                message.recordingYear = object.recordingYear | 0;
        if (object.iswc != null)
            if (typeof object.iswc !== "string" || object.iswc.length)
                message.iswc = $String(object.iswc);
        if (object.territories != null)
            if (typeof object.territories !== "string" || object.territories.length)
                message.territories = $String(object.territories);
        if (object.previewStartMs != null)
            if ($Number(object.previewStartMs) !== 0)
                message.previewStartMs = object.previewStartMs | 0;
        if (object.ownerId != null)
            if (typeof object.ownerId !== "string" || object.ownerId.length)
                message.ownerId = $String(object.ownerId);
        if (object.originPlatform != null)
            if (typeof object.originPlatform !== "string" || object.originPlatform.length)
                message.originPlatform = $String(object.originPlatform);
        if (object.originTimestamp != null)
            if (typeof object.originTimestamp === "object" ? object.originTimestamp.low || object.originTimestamp.high : $Number(object.originTimestamp) !== 0)
                if ($util.Long)
                    message.originTimestamp = $util.Long.fromValue(object.originTimestamp, false);
                else if (typeof object.originTimestamp === "string")
                    message.originTimestamp = $parseInt(object.originTimestamp, 10);
                else if (typeof object.originTimestamp === "number")
                    message.originTimestamp = object.originTimestamp;
                else if (typeof object.originTimestamp === "object")
                    message.originTimestamp = new $util.LongBits(object.originTimestamp.low >>> 0, object.originTimestamp.high >>> 0).toNumber();
        if (object.fingerprintHash != null)
            if (typeof object.fingerprintHash !== "string" || object.fingerprintHash.length)
                message.fingerprintHash = $String(object.fingerprintHash);
        if (object.fingerprintRaw != null)
            if (typeof object.fingerprintRaw !== "string" || object.fingerprintRaw.length)
                message.fingerprintRaw = $String(object.fingerprintRaw);
        return message;
    };

    /**
     * Creates a plain object from a RegistrationPayload message. Also converts values to other types if specified.
     * @function toObject
     * @memberof RegistrationPayload
     * @static
     * @param {RegistrationPayload} message RegistrationPayload
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RegistrationPayload.toObject = function (message, options, _depth) {
        if (!options)
            options = {};
        if (_depth === $undefined)
            _depth = 0;
        if (_depth > $util.recursionLimit)
            throw $Error("max depth exceeded");
        var object = {};
        if (options.defaults) {
            object._v = 0;
            object._t = "";
            object.title = "";
            object.artist = "";
            object.durationMs = 0;
            object.isrc = "";
            object.upc = "";
            object.pLine = "";
            object.cLine = "";
            object.primaryGenre = "";
            object.secondaryGenre = "";
            object.language = "";
            object.bitrate = 0;
            object.sampleRate = 0;
            object.channels = 0;
            object.format = "";
            object.albumTitle = "";
            object.trackNumber = 0;
            object.releaseDate = "";
            object.originalReleaseDate = "";
            object.label = "";
            object.catalogNumber = "";
            object.version = "";
            object.parentalAdvisory = "";
            object.featuredArtists = "";
            object.composers = "";
            object.lyricists = "";
            object.writers = "";
            object.producers = "";
            object.remixer = "";
            object.recordingLocation = "";
            object.recordingYear = 0;
            object.iswc = "";
            object.territories = "";
            object.previewStartMs = 0;
            object.ownerId = "";
            object.originPlatform = "";
            if ($util.Long) {
                var long = new $util.Long(0, 0, false);
                object.originTimestamp = options.longs === $String ? long.toString() : options.longs === $Number ? long.toNumber() : typeof $BigInt !== "undefined" && options.longs === $BigInt ? long.toBigInt() : long;
            } else
                object.originTimestamp = options.longs === $String ? "0" : typeof $BigInt !== "undefined" && options.longs === $BigInt ? $BigInt("0") : 0;
            object.fingerprintHash = "";
            object.fingerprintRaw = "";
        }
        if (message._v != null && $Object.hasOwnProperty.call(message, "_v"))
            object._v = message._v;
        if (message._t != null && $Object.hasOwnProperty.call(message, "_t"))
            object._t = message._t;
        if (message.title != null && $Object.hasOwnProperty.call(message, "title"))
            object.title = message.title;
        if (message.artist != null && $Object.hasOwnProperty.call(message, "artist"))
            object.artist = message.artist;
        if (message.durationMs != null && $Object.hasOwnProperty.call(message, "durationMs"))
            object.durationMs = message.durationMs;
        if (message.isrc != null && $Object.hasOwnProperty.call(message, "isrc"))
            object.isrc = message.isrc;
        if (message.upc != null && $Object.hasOwnProperty.call(message, "upc"))
            object.upc = message.upc;
        if (message.pLine != null && $Object.hasOwnProperty.call(message, "pLine"))
            object.pLine = message.pLine;
        if (message.cLine != null && $Object.hasOwnProperty.call(message, "cLine"))
            object.cLine = message.cLine;
        if (message.primaryGenre != null && $Object.hasOwnProperty.call(message, "primaryGenre"))
            object.primaryGenre = message.primaryGenre;
        if (message.secondaryGenre != null && $Object.hasOwnProperty.call(message, "secondaryGenre"))
            object.secondaryGenre = message.secondaryGenre;
        if (message.language != null && $Object.hasOwnProperty.call(message, "language"))
            object.language = message.language;
        if (message.bitrate != null && $Object.hasOwnProperty.call(message, "bitrate"))
            object.bitrate = message.bitrate;
        if (message.sampleRate != null && $Object.hasOwnProperty.call(message, "sampleRate"))
            object.sampleRate = message.sampleRate;
        if (message.channels != null && $Object.hasOwnProperty.call(message, "channels"))
            object.channels = message.channels;
        if (message.format != null && $Object.hasOwnProperty.call(message, "format"))
            object.format = message.format;
        if (message.albumTitle != null && $Object.hasOwnProperty.call(message, "albumTitle"))
            object.albumTitle = message.albumTitle;
        if (message.trackNumber != null && $Object.hasOwnProperty.call(message, "trackNumber"))
            object.trackNumber = message.trackNumber;
        if (message.releaseDate != null && $Object.hasOwnProperty.call(message, "releaseDate"))
            object.releaseDate = message.releaseDate;
        if (message.originalReleaseDate != null && $Object.hasOwnProperty.call(message, "originalReleaseDate"))
            object.originalReleaseDate = message.originalReleaseDate;
        if (message.label != null && $Object.hasOwnProperty.call(message, "label"))
            object.label = message.label;
        if (message.catalogNumber != null && $Object.hasOwnProperty.call(message, "catalogNumber"))
            object.catalogNumber = message.catalogNumber;
        if (message.version != null && $Object.hasOwnProperty.call(message, "version"))
            object.version = message.version;
        if (message.parentalAdvisory != null && $Object.hasOwnProperty.call(message, "parentalAdvisory"))
            object.parentalAdvisory = message.parentalAdvisory;
        if (message.featuredArtists != null && $Object.hasOwnProperty.call(message, "featuredArtists"))
            object.featuredArtists = message.featuredArtists;
        if (message.composers != null && $Object.hasOwnProperty.call(message, "composers"))
            object.composers = message.composers;
        if (message.lyricists != null && $Object.hasOwnProperty.call(message, "lyricists"))
            object.lyricists = message.lyricists;
        if (message.writers != null && $Object.hasOwnProperty.call(message, "writers"))
            object.writers = message.writers;
        if (message.producers != null && $Object.hasOwnProperty.call(message, "producers"))
            object.producers = message.producers;
        if (message.remixer != null && $Object.hasOwnProperty.call(message, "remixer"))
            object.remixer = message.remixer;
        if (message.recordingLocation != null && $Object.hasOwnProperty.call(message, "recordingLocation"))
            object.recordingLocation = message.recordingLocation;
        if (message.recordingYear != null && $Object.hasOwnProperty.call(message, "recordingYear"))
            object.recordingYear = message.recordingYear;
        if (message.iswc != null && $Object.hasOwnProperty.call(message, "iswc"))
            object.iswc = message.iswc;
        if (message.territories != null && $Object.hasOwnProperty.call(message, "territories"))
            object.territories = message.territories;
        if (message.previewStartMs != null && $Object.hasOwnProperty.call(message, "previewStartMs"))
            object.previewStartMs = message.previewStartMs;
        if (message.ownerId != null && $Object.hasOwnProperty.call(message, "ownerId"))
            object.ownerId = message.ownerId;
        if (message.originPlatform != null && $Object.hasOwnProperty.call(message, "originPlatform"))
            object.originPlatform = message.originPlatform;
        if (message.originTimestamp != null && $Object.hasOwnProperty.call(message, "originTimestamp"))
            if (typeof $BigInt !== "undefined" && options.longs === $BigInt)
                object.originTimestamp = typeof message.originTimestamp === "number" ? $BigInt(message.originTimestamp) : $util.Long.fromBits(message.originTimestamp.low >>> 0, message.originTimestamp.high >>> 0, false).toBigInt();
            else if (typeof message.originTimestamp === "number")
                object.originTimestamp = options.longs === $String ? $String(message.originTimestamp) : message.originTimestamp;
            else
                object.originTimestamp = options.longs === $String ? $util.Long.prototype.toString.call(message.originTimestamp) : options.longs === $Number ? new $util.LongBits(message.originTimestamp.low >>> 0, message.originTimestamp.high >>> 0).toNumber() : message.originTimestamp;
        if (message.fingerprintHash != null && $Object.hasOwnProperty.call(message, "fingerprintHash"))
            object.fingerprintHash = message.fingerprintHash;
        if (message.fingerprintRaw != null && $Object.hasOwnProperty.call(message, "fingerprintRaw"))
            object.fingerprintRaw = message.fingerprintRaw;
        return object;
    };

    /**
     * Converts this RegistrationPayload to JSON.
     * @function toJSON
     * @memberof RegistrationPayload
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RegistrationPayload.prototype.toJSON = function() {
        return RegistrationPayload.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the type url for RegistrationPayload
     * @function getTypeUrl
     * @memberof RegistrationPayload
     * @static
     * @param {string} [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
     * @returns {string} The type url
     */
    RegistrationPayload.getTypeUrl = function(prefix) {
        if (prefix === $undefined)
            prefix = "type.googleapis.com";
        return prefix + "/RegistrationPayload";
    };

    return RegistrationPayload;
})();

module.exports = $root;
