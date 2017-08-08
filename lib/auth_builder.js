'use strict';

/**
 * Functions to create viewers that allow users to pass credentials to resolve
 * functions used by OASGraph.
 */

// Type imports:

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

// Imports:


// Type definitions & exports:


var _graphql = require('graphql');

var _schema_builder = require('./schema_builder.js');

var _schema_builder2 = _interopRequireDefault(_schema_builder);

var _oas_3_tools = require('./oas_3_tools.js');

var _oas_3_tools2 = _interopRequireDefault(_oas_3_tools);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var log = (0, _debug2.default)('translation');

/**
 * Load the field object in the appropriate root object
 *
 * i.e. inside either rootQueryFields/rootMutationFields or inside
 * rootQueryFields/rootMutationFields for further processing
 */
var createAndLoadViewer = function createAndLoadViewer(queryFields, rootFields, usedObjectNames, data, oas) {
  var isMutation = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : false;

  var allFields = {};
  for (var protocolName in queryFields) {
    Object.assign(allFields, queryFields[protocolName]);

    /**
     * check if the name has already been used (i.e. in the list)
     * if so, create a new name and add it to the list
     */
    var _type = data.security[protocolName].def.type;

    /**
     * HTTP is not an authentication protocol
     * HTTP covers a number of different authentication type
     * change the typeName to match the exact authentication type (e.g. basic
     * authentication)
     */
    if (_type === 'http') {
      var scheme = data.security[protocolName].def.scheme;
      switch (scheme) {
        case 'basic':
          _type = 'BasicAuth';
          break;

        default:
          if (data.options.strict) {
            throw new Error('Unsupported scheme ' + String(scheme) + ' for HTTP ' + 'authentication');
          }
          log('Unsupported scheme ' + String(scheme) + ' for HTTP authentication');
      }
    }

    // create name for the viewer
    var objectName = void 0;

    if (!isMutation) {
      objectName = _oas_3_tools2.default.beautify('viewer ' + _type);
    } else {
      objectName = _oas_3_tools2.default.beautify('mutation viewer ' + _type);
    }

    if (!(_type in usedObjectNames)) {
      usedObjectNames[_type] = [];
    }
    if (usedObjectNames[_type].indexOf(objectName) !== -1) {
      objectName += usedObjectNames[_type].length + 1;
      usedObjectNames[_type].push(objectName);
    }
    usedObjectNames[_type].push(objectName);

    // Add the viewer object type to the specified root query object type
    rootFields[objectName] = getViewerOT(objectName, protocolName, _type, queryFields[protocolName], data);
  }

  // create name for the AnyAuth viewer
  var AnyAuthObjectName = void 0;

  if (!isMutation) {
    AnyAuthObjectName = 'viewerAnyAuth';
  } else {
    AnyAuthObjectName = 'mutationViewerAnyAuth';
  }

  // Add the AnyAuth object type to the specified root query object type
  rootFields[AnyAuthObjectName] = getViewerAnyAuthOT(AnyAuthObjectName, allFields, data, oas);
};

/**
 * Gets the viewer Object, resolve function, and arguments
 */
var getViewerOT = function getViewerOT(name, protocolName, type, queryFields, data) {
  var scheme = data.security[protocolName];

  // resolve function:
  var resolve = function resolve(root, args, ctx) {
    var security = {};
    if (typeof protocolName === 'string') {
      security[protocolName] = args;
    } else {
      security.anyAuth = args;
    }

    /**
     * viewers are always root, so we can instantiate _oasgraph here without
     * previously checking for its existence
     */
    return {
      _oasgraph: {
        security: security
      }
    };
  };

  // arguments:
  var args = {};
  if ((typeof scheme === 'undefined' ? 'undefined' : _typeof(scheme)) === 'object') {
    for (var parameterName in scheme.parameters) {
      args[parameterName] = { type: new _graphql.GraphQLNonNull(_graphql.GraphQLString) };
    }
  }

  return {
    type: new _graphql.GraphQLObjectType({
      name: name,
      description: 'A viewer for the security protocol: "' + scheme.rawName + '"',
      fields: queryFields
    }),
    resolve: resolve,
    args: args,
    description: 'A viewer that wraps all operations authenticated via ' + type
  };
};

/**
 * Create an object containing an AnyAuth viewer, its resolve function,
 * and its args.
 */
var getViewerAnyAuthOT = function getViewerAnyAuthOT(name, queryFields, data, oas) {
  var args = {};
  for (var protocolName in data.security) {
    // create input object types for the viewer arguments
    // NOTE: does not need to check for OAuth 2.0 anymore
    // TODO: This is bad. We don't pass an operation, which is needed for
    // creating the GraphQLType, though.
    var _type2 = _schema_builder2.default.getGraphQLType({
      name: protocolName,
      schema: data.security[protocolName].schema,
      data: data,
      oas: oas,
      isMutation: true
    });
    args[protocolName] = { type: _type2 };
  }

  // pass object containing security information to fields
  var resolve = function resolve(root, args, ctx) {
    return {
      _oasgraph: {
        security: args
      }
    };
  };

  return {
    type: new _graphql.GraphQLObjectType({
      name: name,
      description: 'Warning: Not every request will work with this viewer type',
      fields: queryFields
    }),
    resolve: resolve,
    args: args,
    description: 'A viewer that wraps operations for all available ' + 'authentication mechanisms'
  };
};

module.exports = {
  createAndLoadViewer: createAndLoadViewer
};