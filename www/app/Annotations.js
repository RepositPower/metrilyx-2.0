angular.module("metrilyxAnnotations", ['ngResource'])
.factory('EventAnnoService', ['$resource',
    function($resource) {
        return $resource('http://localhost:9898/api/annotations', {}, {
            search: {
                method: 'GET',
                isArray: true
            }
        });
    }
])
.factory('EventAnnoTypesService', ['$resource',
    function($resource) {
        return $resource('http://localhost:9898/api/types/:type', {}, {
            listTypes: {
                method: 'GET',
                isArray: true
            },
            getType: {
                method: 'GET',
                params: { type: '@type' },
                isArray: false
            }
        });
    }
])
.factory("AnnotationsManager", [
    '$location', '$routeParams', '$http', 'EventAnnoTypesService', 'EventAnnoService',
    function($location, $routeParams, $http, EventAnnoTypesService, EventAnnoService) {
        'use strict';

        var AnnotationsManager = function(scope) {

            var t = this;

            var wsock;
            var uri = 'ws://localhost:9898/data';
            
            var maxRetries = 3;
            var retryCount = 0;

            var _callbacks = [];

            var _expectedListeners = 0;
/*
            var scopeAttributes = {
                //annoFilter: parseAnnoParams(),
                //setAnnotationsFilter: setAnnotationsFilter,
                //addAnnotationListener: addAnnotationListener,
                eventAnnoTypes: {}
            };
*/
            function _parseAnnoTags() {
                var out = {};
                if ($routeParams.annotationTags) {
                    
                    var annoTagKVs = $routeParams.annotationTags.split(",");
                    for(var i=0; i<annoTagKVs.length; i++) {
                        
                        var kv = annoTagKVs[i].split(":");
                        if(kv.length !== 2 || kv[0] === '' || kv[1] === '') {
                            console.log('invalid annotation tags: '+kv);
                            continue;
                        } else {
                            out[kv[0]] = kv[1];
                        }
                    }
                }
                return out;
            }

            function _parseAnnoTypes() {
                
                var out = [];
                if($routeParams.annotationTypes !== undefined) {
                    var annoTypes = $routeParams.annotationTypes.split(",");
                    for(var i=0; i<annoTypes.length; i++) {
                        if(annoTypes[i] !== '') 
                            out.push(annoTypes[i]);
                    }
                }
                return out;
            }

            function _types2string(annoIdx) {
                var out = [];
                for(var k in annoIdx) {
                    if(annoIdx[k].selected) out.push(k);
                }
                return out.join(',');
            }

            function setAnnotationsFilter(evtAnnoTypes, annoTagsFilter) {
                var tmp = $location.search();
                $.extend(true, tmp, {
                    annotationTypes: _types2string(evtAnnoTypes),
                    annotationTags: dictToCommaSepStr(annoTagsFilter, ':')
                }, true);

                $location.search(tmp);
            }

            function parseAnnoParams() {
                return {
                    tags: _parseAnnoTags(),
                    types: _parseAnnoTypes() /* this holds the types used for subscription */
                };
            }

            function sendMessage(data) {
                wsock.send(JSON.stringify(data));
            }

            function onWsOpen(evt) {
                console.log('Connection open', evt);
                retryCount = 0;
                /* subsciption message */
                sendMessage(scope.annoFilter);
                //sendMessage(scopeAttributes.annoFilter);

                for(var i=0; i< _callbacks.length; i++) {
                    console.log('adding listener...');
                    wsock.addEventListener('annotation', _callbacks[i]);
                } 
            }

            function onWsClose(evt) {
                console.log('Connection closed', evt);
                wsock = null;
                
                console.log('Reconnecting in 5 sec...');
                setTimeout(function() {
                    if(retryCount < maxRetries) {
                        connect();
                        retryCount++;
                    } else {
                        console.log('Max retries exceeded!');
                    }
                }, 5000);
            }

            function msgErrback(e) {
                console.error('Subscriber error:', e.data);
                console.warn(e);
            }

            function onWsMessage(evt) {
                var data;
                try {
                    data = JSON.parse(evt.data);
                } catch(e) {
                    msgErrback(e)
                    return;
                }
                if(data.error !== undefined) {
                    msgErrback(evt);
                } else {
                    //console.log('on message', data);
                    wsock.dispatchEvent(new CustomEvent('annotation', {'detail': data}));
                    //t.dispatchEvent(new CustomEvent('annotation', {'detail': data}));
                }
            }

            function connect(expectedListeners) {
                _expectedListeners = expectedListeners;

                wsock = new WebSocket(uri);
                wsock.addEventListener('open', onWsOpen);
                wsock.addEventListener('message', onWsMessage);
                wsock.addEventListener('close', onWsClose);
            }

            function _getAnnoQuery() {
                var q = scope.getTimeWindow();
                q.types = _types2string(scope.eventAnnoTypes);
                q.tags = dictToCommaSepStr(scope.annoFilter.tags, ':');
                
                if(q.tags === '') delete q.tags;
                if(q.types === '') delete q.types;
                
                return q;
            }

            function fetchAnnotationsForTimeFrame() {
                
                var q = _getAnnoQuery();
                if(!q.tags && !q.types) return;

                EventAnnoService.search(q, function(result) {
                    
                    wsock.dispatchEvent(new CustomEvent('annotation', {'detail': result}));
                    //t.dispatchEvent(new CustomEvent('annotation', {'detail': result}));
                }, msgErrback);
            }

            function addAnnotationListener(callback) {
                _callbacks.push(callback);
                if(wsock) {
                    wsock.addEventListener('annotation', callback);
                    /* Fetch data once all event listeners (i.e. graphs) have been registered  */
                    if(_expectedListeners === _callbacks.length) {
                        fetchAnnotationsForTimeFrame();
                    }
                }
            }

            function initializeAnnoAndTypes() {
                EventAnnoTypesService.listTypes(function(result) {
                    var _eventAnnoTypes = {};
                    for(var j=0; j< result.length; j++) {
                        result[j].selected = false;
                        _eventAnnoTypes[result[j].id] = result[j];
                    }
                    /* Set selected types */
                    for( var j=0; j< scope.annoFilter.types.length; j++ ) {
                        
                        _eventAnnoTypes[scope.annoFilter.types[j]].selected = true;
                    }
                    /* Set scope */
                    scope.eventAnnoTypes = _eventAnnoTypes;
                });
            }

            function _initialize() {
                /* Sets eventAnnoTypes (i.e. list of types) to scope. */
                initializeAnnoAndTypes();
                /* This will actually be set before the above call because async */
                scope.annoFilter = parseAnnoParams();
                scope.addAnnotationListener = addAnnotationListener;
                scope.setAnnotationsFilter = setAnnotationsFilter;

                t.fetchAnnotationsForTimeFrame = fetchAnnotationsForTimeFrame;
                t.sendMessage = sendMessage;
                t.connect = connect;
            }

            _initialize();
        };

        return (AnnotationsManager);
    }
])
.factory('AnnotationUIManager', [ 
    function() {
        'use strict';
        
        var AnnotationUIManager = function(graphId, scope) {

            var t = this;

            var _domNode = $("[data-graph-id='"+graphId+"']");
            var _chart = $(_domNode).highcharts();

            var _timeout;

            function _sortAnno(a,b) {
                if (a.x < b.x) return -1;
                if (a.x > b.x) return 1;
                return 0;
            }

            function _formatAnnoToHighcharts(anno) {
                return {
                    x: anno.timestamp*1000,
                    title: anno.type,
                    text: anno.message,
                    data: anno.data
                };
            }

            function _formatToHighchartsTypeIndex(annoData) {
                var out = {};
                for(var i=0;i< annoData.length; i++) {
                    if(!out[annoData[i].type.toLowerCase()]) {
                        out[annoData[i].type.toLowerCase()] = [];
                    }
                    out[annoData[i].type.toLowerCase()].push(_formatAnnoToHighcharts(annoData[i]));
                }
                return out;
            }

            function _newSerieData(serie, newData) {
                var ndata = [];
                for(var i=0; i < serie.data.length; i++) {
                    try {
                        if(serie.data[i].x < newData[0].x) {
                            ndata.push({
                                x: serie.data[i].x,
                                title: serie.data[i].title,
                                text: serie.data[i].text,
                                data: serie.data[i].data
                            });
                        } else if(!equalObjects(serie.data[i], newData[0])) {
                            ndata.push({
                                x: serie.data[i].x,
                                title: serie.data[i].title,
                                text: serie.data[i].text,
                                data: serie.data[i].data
                            });
                        } else {
                            break;
                        }
                    } catch(e) {
                        console.error(e);
                        console.log(serie.data, newData);
                    }
                }

                for(var i=0; i < newData.length; i++)
                    ndata.push(newData[i]);

                return ndata;
            }

            function addAnnotations(data) {
                if(data.length < 1) return;

                _chart = $(_domNode).highcharts();
                if(_chart === undefined) {

                    if(_timeout) clearTimeout(_timeout);
                    _timeout = setTimeout(function() {  addAnnotations(data); }, 3000);
                } else {

                    var idx = _formatToHighchartsTypeIndex(data);
                    for(var k in idx) {
                        
                        idx[k].sort(_sortAnno);

                        var serie = _chart.get(k)
                        if(serie) {
                            
                            var ndata = _newSerieData(serie, idx[k]);
                            serie.setData(ndata, false, false);
                        } else {
                            
                            var sf = new SeriesFormatter(idx[k]);
                            _chart.addSeries(sf.flagsSeries({ 
                                name: idx[k][0].title,
                                id: k,
                                color: scope.eventAnnoTypes[k].metadata.color
                            }));
                        }
                    }
                    _chart.redraw();
                }
            }

            function _initialize() {
                t.addAnnotations = addAnnotations;
            }

            _initialize();
        };
        return (AnnotationUIManager);
}]);