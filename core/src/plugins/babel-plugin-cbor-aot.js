module.exports = function (babel) {
  const { types: t, template } = babel;

  return {
    name: 'babel-plugin-cbor-aot',
    visitor: {
      ClassDeclaration(path) {
        // 1. Check for @cbor decorator
        const decorators = path.node.decorators;
        if (!decorators || decorators.length === 0) return;

        const cborDecoratorIndex = decorators.findIndex(
          (d) => t.isIdentifier(d.expression, { name: 'cbor' })
        );

        if (cborDecoratorIndex === -1) return;

        // 2. Strip the @cbor decorator
        decorators.splice(cborDecoratorIndex, 1);
        if (decorators.length === 0) {
          path.node.decorators = null;
        }

        // 3. Find and strip properties
        const properties = [];
        const nonProperties = [];

        for (const element of path.node.body.body) {
          if (t.isClassProperty(element)) {
            properties.push(element);
          } else {
            nonProperties.push(element);
          }
        }

        // Strip the class properties
        path.node.body.body = nonProperties;

        // 4. Generate runtime size calculation and serialization code
        const sizeStatements = [];
        const writeStatements = [];
        const readStatements = [];

        // Base size logic
        sizeStatements.push(`let _size = 0;`);
        writeStatements.push(`let _offset = 0;`);
        readStatements.push(`let _offset = 0;`);
        readStatements.push(`const obj = new this();`);

        // Assuming a CBOR Map representation for the object.
        // Map header: 0xa0 + number of properties (assuming <= 23 for phase 1 sprint)
        const mapHeader = 0xa0 + properties.length;
        sizeStatements.push(`_size += 1; // Map header`);
        writeStatements.push(`buf[_offset++] = ${mapHeader};`);
        readStatements.push(`_offset++; // Skip Map header`);

        for (const prop of properties) {
          // Identify the key name
          let keyName;
          if (t.isIdentifier(prop.key)) {
            keyName = prop.key.name;
          } else if (t.isStringLiteral(prop.key)) {
            keyName = prop.key.value;
          } else {
            continue; // Skip computed or non-standard keys for now
          }
          
          // Write string key (assuming length <= 23 for sprint)
          const keyLen = keyName.length;
          sizeStatements.push(`_size += ${1 + keyLen}; // Key: ${keyName}`);
          
          writeStatements.push(`buf[_offset++] = ${0x60 + keyLen};`);
          for (let i = 0; i < keyLen; i++) {
            writeStatements.push(`buf[_offset++] = ${keyName.charCodeAt(i)};`);
          }

          // Read key skipping
          readStatements.push(`_offset += ${1 + keyLen}; // Skip Key: ${keyName}`);

          // Extract validation constraints from decorators
          let min = null;
          let max = null;
          let maxLength = null;

          if (prop.decorators) {
            prop.decorators = prop.decorators.filter(d => {
              if (t.isCallExpression(d.expression)) {
                if (t.isIdentifier(d.expression.callee, { name: 'uint32' })) {
                  const arg = d.expression.arguments[0];
                  if (t.isObjectExpression(arg)) {
                    arg.properties.forEach(p => {
                      if (p.key.name === 'min') min = p.value.value;
                      if (p.key.name === 'max') max = p.value.value;
                    });
                  }
                  return false; // Strip decorator
                }
                if (t.isIdentifier(d.expression.callee, { name: 'string' })) {
                  const arg = d.expression.arguments[0];
                  if (t.isObjectExpression(arg)) {
                    arg.properties.forEach(p => {
                      if (p.key.name === 'maxLength') maxLength = p.value.value;
                    });
                  }
                  return false; // Strip decorator
                }
              }
              return true;
            });
            if (prop.decorators.length === 0) prop.decorators = null;
          }

          // Determine value type from TS annotation
          let isBoolean = false;
          let isNumber = false;
          let isString = false;
          let isArray = false;

          const typeAnn = prop.typeAnnotation?.typeAnnotation;
          if (t.isTSBooleanKeyword(typeAnn) || (t.isTSTypeReference(typeAnn) && t.isIdentifier(typeAnn.typeName, { name: 'Boolean' }))) {
            isBoolean = true;
          } else if (t.isTSNumberKeyword(typeAnn) || (t.isTSTypeReference(typeAnn) && t.isIdentifier(typeAnn.typeName, { name: 'Number' }))) {
            isNumber = true;
          } else if (t.isTSStringKeyword(typeAnn) || (t.isTSTypeReference(typeAnn) && t.isIdentifier(typeAnn.typeName, { name: 'String' }))) {
            isString = true;
          } else if (t.isTSArrayType(typeAnn) || (t.isTSTypeReference(typeAnn) && t.isIdentifier(typeAnn.typeName, { name: 'Array' }))) {
            isArray = true;
          }

          if (isBoolean) {
            sizeStatements.push(`_size += 1;`);
            writeStatements.push(`buf[_offset++] = this.${keyName} ? 0xf5 : 0xf4;`);
            readStatements.push(`
              const tag_${keyName} = buf[_offset++];
              if (tag_${keyName} === 0xf5) {
                obj.${keyName} = true;
              } else if (tag_${keyName} === 0xf4) {
                obj.${keyName} = false;
              } else {
                throw new Error("Validation Error: Expected boolean for property ${keyName}");
              }
            `);
          } else if (isNumber) {
            // Encode as 32-bit integer (always using 5 bytes for AOT fixed layout to avoid branching byte-sizes)
            sizeStatements.push(`_size += 5;`);
            writeStatements.push(`
              if (this.${keyName} >= 0) {
                buf[_offset++] = 0x1a;
                buf[_offset++] = (this.${keyName} >>> 24) & 0xff;
                buf[_offset++] = (this.${keyName} >>> 16) & 0xff;
                buf[_offset++] = (this.${keyName} >>> 8) & 0xff;
                buf[_offset++] = this.${keyName} & 0xff;
              } else {
                buf[_offset++] = 0x3a;
                const val_${keyName} = -this.${keyName} - 1;
                buf[_offset++] = (val_${keyName} >>> 24) & 0xff;
                buf[_offset++] = (val_${keyName} >>> 16) & 0xff;
                buf[_offset++] = (val_${keyName} >>> 8) & 0xff;
                buf[_offset++] = val_${keyName} & 0xff;
              }
            `);
            
            let valChecks = '';
            if (min !== null || max !== null) {
              const conds = [];
              if (min !== null) conds.push(`val_${keyName} < ${min}`);
              if (max !== null) conds.push(`val_${keyName} > ${max}`);
              valChecks = `if (${conds.join(' || ')}) throw new Error("Validation Error: boundary check failed for ${keyName}");`;
            }

            readStatements.push(`
              const tag_${keyName} = buf[_offset++];
              let val_${keyName};
              if (tag_${keyName} === 0x1a) {
                val_${keyName} = ((buf[_offset++] << 24) | (buf[_offset++] << 16) | (buf[_offset++] << 8) | buf[_offset++]) >>> 0;
              } else if (tag_${keyName} === 0x3a) {
                const uval = ((buf[_offset++] << 24) | (buf[_offset++] << 16) | (buf[_offset++] << 8) | buf[_offset++]) >>> 0;
                val_${keyName} = -uval - 1;
              } else {
                throw new Error("Validation Error: Expected 32-bit integer for property ${keyName}");
              }
              ${valChecks}
              obj.${keyName} = val_${keyName};
            `);
          } else if (isString) {
            sizeStatements.push(`
              const len_${keyName} = this.constructor._utf8ByteLength(this.${keyName});
              if (len_${keyName} < 24) { _size += 1 + len_${keyName}; }
              else if (len_${keyName} <= 0xff) { _size += 2 + len_${keyName}; }
              else if (len_${keyName} <= 0xffff) { _size += 3 + len_${keyName}; }
              else { _size += 5 + len_${keyName}; }
            `);
            writeStatements.push(`
              if (len_${keyName} < 24) { buf[_offset++] = 0x60 + len_${keyName}; }
              else if (len_${keyName} <= 0xff) { buf[_offset++] = 0x78; buf[_offset++] = len_${keyName}; }
              else if (len_${keyName} <= 0xffff) { buf[_offset++] = 0x79; buf[_offset++] = (len_${keyName} >>> 8) & 0xff; buf[_offset++] = len_${keyName} & 0xff; }
              else { buf[_offset++] = 0x7a; buf[_offset++] = (len_${keyName} >>> 24) & 0xff; buf[_offset++] = (len_${keyName} >>> 16) & 0xff; buf[_offset++] = (len_${keyName} >>> 8) & 0xff; buf[_offset++] = len_${keyName} & 0xff; }
              _offset += this.constructor._writeString(this.${keyName}, buf, _offset);
            `);
            
            let strValChecks = '';
            if (maxLength !== null) {
              strValChecks = `if (strLen_${keyName} > ${maxLength}) throw new Error("Validation Error: string length exceeds max for ${keyName}");`;
            }

            readStatements.push(`
              const strTag_${keyName} = buf[_offset++];
              let strLen_${keyName} = 0;
              if (strTag_${keyName} >= 0x60 && strTag_${keyName} < 0x78) {
                strLen_${keyName} = strTag_${keyName} - 0x60;
              } else if (strTag_${keyName} === 0x78) {
                strLen_${keyName} = buf[_offset++];
              } else if (strTag_${keyName} === 0x79) {
                strLen_${keyName} = (buf[_offset++] << 8) | buf[_offset++];
              } else if (strTag_${keyName} === 0x7a) {
                strLen_${keyName} = ((buf[_offset++] << 24) | (buf[_offset++] << 16) | (buf[_offset++] << 8) | buf[_offset++]) >>> 0;
              } else {
                throw new Error("Validation Error: Expected string for property ${keyName}");
              }
              ${strValChecks}
              obj.${keyName} = this._readString(buf, _offset, strLen_${keyName});
              _offset += strLen_${keyName};
            `);
          } else if (isArray) {
            sizeStatements.push(`
              const arrLen_${keyName} = this.${keyName}.length;
              if (arrLen_${keyName} < 24) { _size += 1; }
              else if (arrLen_${keyName} <= 0xff) { _size += 2; }
              else if (arrLen_${keyName} <= 0xffff) { _size += 3; }
              else { _size += 5; }
              // Assume Array of Numbers (32-bit fixed 5 bytes each)
              _size += arrLen_${keyName} * 5;
            `);
            writeStatements.push(`
              if (arrLen_${keyName} < 24) { buf[_offset++] = 0x80 + arrLen_${keyName}; }
              else if (arrLen_${keyName} <= 0xff) { buf[_offset++] = 0x98; buf[_offset++] = arrLen_${keyName}; }
              else if (arrLen_${keyName} <= 0xffff) { buf[_offset++] = 0x99; buf[_offset++] = (arrLen_${keyName} >>> 8) & 0xff; buf[_offset++] = arrLen_${keyName} & 0xff; }
              else { buf[_offset++] = 0x9a; buf[_offset++] = (arrLen_${keyName} >>> 24) & 0xff; buf[_offset++] = (arrLen_${keyName} >>> 16) & 0xff; buf[_offset++] = (arrLen_${keyName} >>> 8) & 0xff; buf[_offset++] = arrLen_${keyName} & 0xff; }
              for (let _i = 0; _i < arrLen_${keyName}; _i++) {
                const elem = this.${keyName}[_i];
                if (elem >= 0) {
                  buf[_offset++] = 0x1a;
                  buf[_offset++] = (elem >>> 24) & 0xff;
                  buf[_offset++] = (elem >>> 16) & 0xff;
                  buf[_offset++] = (elem >>> 8) & 0xff;
                  buf[_offset++] = elem & 0xff;
                } else {
                  buf[_offset++] = 0x3a;
                  const val_elem = -elem - 1;
                  buf[_offset++] = (val_elem >>> 24) & 0xff;
                  buf[_offset++] = (val_elem >>> 16) & 0xff;
                  buf[_offset++] = (val_elem >>> 8) & 0xff;
                  buf[_offset++] = val_elem & 0xff;
                }
              }
            `);
            
            readStatements.push(`
              const arrTag_${keyName} = buf[_offset++];
              let arrLen_${keyName} = 0;
              if (arrTag_${keyName} >= 0x80 && arrTag_${keyName} < 0x98) {
                arrLen_${keyName} = arrTag_${keyName} - 0x80;
              } else if (arrTag_${keyName} === 0x98) {
                arrLen_${keyName} = buf[_offset++];
              } else if (arrTag_${keyName} === 0x99) {
                arrLen_${keyName} = (buf[_offset++] << 8) | buf[_offset++];
              } else if (arrTag_${keyName} === 0x9a) {
                arrLen_${keyName} = ((buf[_offset++] << 24) | (buf[_offset++] << 16) | (buf[_offset++] << 8) | buf[_offset++]) >>> 0;
              } else {
                throw new Error("Validation Error: Expected array for property ${keyName}");
              }
              
              const arr_${keyName} = new Array(arrLen_${keyName});
              for (let _i = 0; _i < arrLen_${keyName}; _i++) {
                const tag_elem = buf[_offset++];
                let val_elem;
                if (tag_elem === 0x1a) {
                  val_elem = ((buf[_offset++] << 24) | (buf[_offset++] << 16) | (buf[_offset++] << 8) | buf[_offset++]) >>> 0;
                } else if (tag_elem === 0x3a) {
                  const uval = ((buf[_offset++] << 24) | (buf[_offset++] << 16) | (buf[_offset++] << 8) | buf[_offset++]) >>> 0;
                  val_elem = -uval - 1;
                } else {
                  throw new Error("Validation Error: Expected 32-bit integer for array element in ${keyName}");
                }
                arr_${keyName}[_i] = val_elem;
              }
              obj.${keyName} = arr_${keyName};
            `);
          } else {
            writeStatements.push(`// Unsupported type for property: ${keyName}`);
          }
        }

        // 5. Inject the compiled toCBOR() method and static fromCBOR() method
        const methodCode = `
          toCBOR() {
            ${sizeStatements.join('\n')}
            const buf = new Uint8Array(_size);
            ${writeStatements.join('\n')}
            return buf;
          }
        `;
        
        const readStringCode = `
          static _readString(buffer, start, length) {
            let res = "";
            let end = start + length;
            if (end > buffer.length) end = buffer.length; // Safe bounds check
            while (start < end) {
              let t = buffer[start++];
              if (t <= 0x7F) {
                res += String.fromCharCode(t);
              } else if (t >= 0xC0 && t < 0xE0) {
                res += String.fromCharCode((t & 0x1F) << 6 | buffer[start++] & 0x3F);
              } else if (t >= 0xE0 && t < 0xF0) {
                res += String.fromCharCode((t & 0xF) << 12 | (buffer[start++] & 0x3F) << 6 | buffer[start++] & 0x3F);
              } else if (t >= 0xF0) {
                let t2 = ((t & 7) << 18 | (buffer[start++] & 0x3F) << 12 | (buffer[start++] & 0x3F) << 6 | buffer[start++] & 0x3F) - 0x10000;
                res += String.fromCharCode(0xD800 + (t2 >> 10), 0xDC00 + (t2 & 0x3FF));
              }
            }
            return res;
          }
        `;
        
        const utf8ByteLengthCode = `
          static _utf8ByteLength(str) {
            let len = 0;
            for (let i = 0; i < str.length; i++) {
              let c = str.charCodeAt(i);
              if (c < 0x80) len += 1;
              else if (c < 0x800) len += 2;
              else if (c >= 0xd800 && c < 0xe000) {
                len += 4; i++;
              }
              else len += 3;
            }
            return len;
          }
        `;

        const writeStringCode = `
          static _writeString(str, buf, offset) {
            let start = offset;
            for (let i = 0; i < str.length; i++) {
              let c = str.charCodeAt(i);
              if (c < 0x80) {
                buf[offset++] = c;
              } else if (c < 0x800) {
                buf[offset++] = 0xc0 | (c >> 6);
                buf[offset++] = 0x80 | (c & 0x3f);
              } else if (c >= 0xd800 && c < 0xe000) {
                let c2 = str.charCodeAt(i + 1);
                c = 0x10000 + (((c & 0x3ff) << 10) | (c2 & 0x3ff));
                i++;
                buf[offset++] = 0xf0 | (c >> 18);
                buf[offset++] = 0x80 | ((c >> 12) & 0x3f);
                buf[offset++] = 0x80 | ((c >> 6) & 0x3f);
                buf[offset++] = 0x80 | (c & 0x3f);
              } else {
                buf[offset++] = 0xe0 | (c >> 12);
                buf[offset++] = 0x80 | ((c >> 6) & 0x3f);
                buf[offset++] = 0x80 | (c & 0x3f);
              }
            }
            return offset - start;
          }
        `;

        const fromCborCode = `
          static fromCBOR(buf) {
            ${readStatements.join('\n')}
            return obj;
          }
        `;
        
        // Build AST for the injected methods
        let parsedMethod;
        let parsedReadString;
        let parsedUtf8ByteLength;
        let parsedWriteString;
        let parsedFromCbor;
        try {
          // Attempt the cleaner classMethod parser first
          parsedMethod = template.classMethod(methodCode)();
          parsedReadString = template.classMethod(readStringCode)();
          parsedUtf8ByteLength = template.classMethod(utf8ByteLengthCode)();
          parsedWriteString = template.classMethod(writeStringCode)();
          parsedFromCbor = template.classMethod(fromCborCode)();
        } catch (e) {
          // Fallback parsing via full class if template.classMethod is missing/fails
          const classCode = `class __TEMP { ${methodCode} ${readStringCode} ${utf8ByteLengthCode} ${writeStringCode} ${fromCborCode} }`;
          const classAst = template.statements(classCode)();
          parsedMethod = classAst[0].body.body[0];
          parsedReadString = classAst[0].body.body[1];
          parsedUtf8ByteLength = classAst[0].body.body[2];
          parsedWriteString = classAst[0].body.body[3];
          parsedFromCbor = classAst[0].body.body[4];
        }

        path.node.body.body.push(parsedMethod, parsedReadString, parsedUtf8ByteLength, parsedWriteString, parsedFromCbor);
      },
    },
  };
};
