angular.module("metrilyxHelperFactories", [])
.factory("ComponentTemplates", function() {

	var ComponentTemplates = function(scope) {

		var partialsPrefix = "/ui/partials";

		var templates = {
			pageMastHtml	: connectionPool.nextConnection()+partialsPrefix+"/page-mast.html",
		};

		function initialize() {
			if(scope.modelType == "adhoc" || scope.modelType == "") {

				$.extend(templates, {
					editPanelHtml			: connectionPool.nextConnection()+partialsPrefix+"/edit-panel.html",
					thresholdsHtml 			: connectionPool.nextConnection()+partialsPrefix+"/thresholds.html",
					pageHeaderHtml 			: connectionPool.nextConnection()+partialsPrefix+"/page-header.html",
					annoControlsHtml		: connectionPool.nextConnection()+partialsPrefix+"/global-anno-controls.html",
					eventAnnoDetailsHtml 	: connectionPool.nextConnection()+partialsPrefix+"/event-anno-details.html",
					metricOperationsHtml	: connectionPool.nextConnection()+partialsPrefix+"/metric-operations.html",
					pageFooterHtml			: connectionPool.nextConnection()+partialsPrefix+"/page-footer.html",
					graphFooterHtml			: connectionPool.nextConnection()+partialsPrefix+"/graph-footer.html"
				}, true);

				if(scope.modelType == "adhoc") {

					templates['queryEditorHtml'] = connectionPool.nextConnection()+partialsPrefix+"/adhocgraph-query-editor.html";
				} else {

					$.extend(templates, {
						queryEditorHtml		: connectionPool.nextConnection()+partialsPrefix+"/pagegraph-query-editor.html",
						graphControlsHtml	: connectionPool.nextConnection()+partialsPrefix+"/graph-controls.html",
						graphHtml 			: connectionPool.nextConnection()+partialsPrefix+"/graph.html",
						podHtml 			: connectionPool.nextConnection()+partialsPrefix+"/pod.html",
					}, true);
				}
			}
			$.extend(scope, templates, true);
		}

		initialize();
	}
	return (ComponentTemplates);
})
.factory("CtrlCommon", ['Metrics', 'Schema', '$route', '$location', function(Metrics, Schema, $route, $location) {

	var CtrlCommon = function(scope) {

		var timerSearchForMetric;

		function setUpdatesEnabled(value) {
			scope.updatesEnabled = value;
		}

		function updateTagsOnPage(obj) {
			var top = scope.tagsOnPage;
			for(var k in obj) {
				if(Object.prototype.toString.call(obj[k]) === '[object Array]') {
					if(top[k] == undefined) {
						top[k] = obj[k];
						top[k].push("*");
					} else {
						for(var i=0; i < obj[k].length; i++) {
							if(top[k].indexOf(obj[k][i]) < 0) top[k].push(obj[k][i]);
						}
					}
				} else {
					if(top[k] == undefined) {
						top[k] = ["*"];
						top[k].push(obj[k]);
					} else if(top[k].indexOf(obj[k]) < 0) {
						top[k].push(obj[k]);
					}
				}
			}
			scope.tagsOnPage = top;
		}

		function searchForMetric(args) {

			if (timerSearchForMetric) clearTimeout(timerSearchForMetric);

			var myThis = this;
			timerSearchForMetric = setTimeout(function(){

				var qstr;
				if(args && args !== "") qstr = args;
				if(myThis.metricQuery && myThis.metricQuery !== "") qstr = myThis.metricQuery;
				if(qstr == "" || qstr == undefined) return;

				Metrics.suggest(qstr, function(result) {

					scope.metricQuery = qstr;
					Schema.get({modelType:'metric'}, function(graphModel) {

						var arr = [];
						for(var i in result) {
							obj = JSON.parse(JSON.stringify(graphModel));
							if(obj.err) {
								console.log(obj);
								continue;
							}
							obj.alias = result[i];
							obj.query.metric = result[i];
							arr.push(obj);
						}

						scope.metricQueryResult = arr;
					});
				});
			}, 1000);
		}

		function disableDragDrop() {
			$('[ui-sortable]').each(function() {
				$(this).sortable({disabled: true});
			});
		}

		function enableDragDrop() {
			$('[ui-sortable]').each(function() {
				$(this).sortable({disabled: false});
			});
		}

		function loadHome() {
			$location.path('/graph').search({});
			$route.reload();
		}

		scope.disableDragDrop 	= disableDragDrop;
		scope.enableDragDrop	= enableDragDrop;
		scope.loadHome 			= loadHome;
		scope.setUpdatesEnabled = setUpdatesEnabled;
		scope.updateTagsOnPage 	= updateTagsOnPage;
		scope.searchForMetric 	= searchForMetric;

	}

	return (CtrlCommon);
}])
.factory("AnnotationOptions", ['$location', '$routeParams', 'EventTypes', function($location, $routeParams, EventTypes) {

	var AnnotationOptions = function(scope) {

		var scopeAttributes = {
			'globalAnno': {'eventTypes':[], 'tags':{}, 'status': null },
			'selectedAnno': {},
			'setAnnotations': applyAnnotationOptions
		};

		function initialize() {

			if($routeParams.annotationTypes && $routeParams.annotationTags) {

				try {

					$.extend(true, scopeAttributes['globalAnno'], {
						'eventTypes': $routeParams.annotationTypes.split(/\|/),
						'tags': commaSepStrToDict($routeParams.annotationTags),
					}, true);
				} catch(e) { console.warning("failed to parse annotation data", e); }
			}

			if(scopeAttributes.globalAnno.eventTypes.length > 0 && Object.keys(scopeAttributes.globalAnno.tags).length > 0)
				scopeAttributes.globalAnno['status'] = 'load';

			// Apply this first as the next call will take some time
			$.extend(scope, scopeAttributes, true);

			// Get all available event types
			EventTypes.listTypes(function(rslt) {

				var evtTypeList = [];
				for(var i in rslt) {

					if(rslt[i].name === undefined || scopeAttributes.globalAnno.eventTypes.indexOf(rslt[i].name) >= 0) continue;
					evtTypeList.push(rslt[i].name);
				}

				$.extend(scope, {annoEventTypes: evtTypeList}, true);
			});
		}


		function applyAnnotationOptions() {

			if(scope.modelType == "adhoc") {

				scope.reloadGraph();
				scope.globalAnno.status = 'reload';

				$('.graph-control-details.global-anno').hide();
			}

			var tmp = $location.search();
			tmp.annotationTypes = scope.globalAnno.eventTypes.join("|");
			tmp.annotationTags = dictToCommaSepStr(scope.globalAnno.tags, ":");
			$location.search(tmp);
		}

		initialize();
	}
	return (AnnotationOptions);
}])
.factory("TimeWindow", ['$routeParams', function($routeParams) {

	var TimeWindow = function(scope) {
		var t = this;

		var scopeAttributes = {
			'timeType': '1h-ago',
			'startTime': '1h-ago',
			'updatesEnabled': true,
			'getTimeWindow': getTimeFrame,
			'setStartTime': setStartTime,
			'setEndTime': setEndTime
		};

		function initialize() {

			if(scope.modelType === "adhoc") scopeAttributes['updatesEnabled'] = false;

			if($routeParams.start) {

				if($routeParams.end) {

					$.extend(true, scopeAttributes, {
						'endTime': parseInt($routeParams.end),
						'timeType': "absolute",
						'updatesEnabled': false
					}, true);
				} else {

					scopeAttributes['timeType'] = $routeParams.start;
				}
				if(Object.prototype.toString.call($routeParams.start) === '[object String]'
													&& $routeParams.start.match(/-ago$/)) {
					scopeAttributes['startTime'] = $routeParams.start;
				} else {
					scopeAttributes['startTime'] = parseInt($routeParams.start);
				}
			}
			$.extend(scope, scopeAttributes, true);
		}

		function getTimeFrame(inMilli) {
			if(scope.timeType == "absolute"){
				if(scope.endTime) {
					if(inMilli) {
						return {
							end: scope.endTime*1000,
							start: scope.startTime*1000};
					}
					return {
						end: scope.endTime,
						start: scope.startTime
					};
				}
				if(inMilli) {
					return {
						start: scope.startTime*1000,
						end: Math.ceil((new Date()).getTime())
					};
				}
				return {
					start: scope.startTime,
					end: Math.ceil((new Date()).getTime()/1000)
				};
			} else {
				if(inMilli) {
					return {
						start: (Math.floor(((new Date()).getTime()/1000)-relativeToAbsoluteTime(scope.timeType)))*1000,
						end: Math.ceil((new Date()).getTime())
					};
				} else {
					return {
						start: Math.floor(((new Date()).getTime()/1000)-relativeToAbsoluteTime(scope.timeType)),
						end: Math.ceil((new Date()).getTime()/1000)
					};
				}
			}
		}

		t.setAttribute = function(attr, value) {

			switch(attr) {

				case "timeType":
					scope.timeType = value;
					break;

				case "startTime":
					if(scope.endTime && (value >= scope.endTime)) return;
					scope.startTime = value;
					break;

				case "endTime":
					if(scope.startTime && (value <= scope.startTime)) return;
					scope.endTime = value;
					break;

				default:
					break;
			}
		}

		function setStartTime(sTime) {
			t.setAttribute('startTime', sTime);
		}

		function setEndTime(eTime) {
			t.setAttribute('endTime', eTime);
		}

		initialize();
	};
	return (TimeWindow);
}])
.factory("RouteManager", ['$routeParams', function($routeParams) {

	var RouteManager = function(scope) {

		var t = this;

		function setPageGlobalTags() {

			try {
				scope.$parent.globalTags = $routeParams.tags ? commaSepStrToDict($routeParams.tags) : {};
			} catch(e) {
				console.warn("Could not parse global tags!");
				scope.globalTags = {};
			}
		}

		function initialize() {

			var scopeOpts = {};

			if(scope.modelType === "adhoc") {

				scopeOpts.editMode = $routeParams.editMode === "false" ? "" : " edit-mode";
			} else {


				scopeOpts.editMode = (!$routeParams.editMode || $routeParams.editMode === "false") ? scope.editMode = "" : " edit-mode";
				scopeOpts.editMode = $routeParams.pageId == "new" ? " edit-mode" : "";
				// Parent global tags scope get's set so it cannot but coupled with the above logic and has to be separately. //
				setPageGlobalTags();
			}

			//scopeOpts.updatesEnabled = scopeOpts.editMode === " edit-mode" ? false : true;

			$.extend(true, scope, scopeOpts, true);

		}

		function parseAdhocMetricParams() {

			var series = [];
			if($routeParams.m) {
				var metrics = Object.prototype.toString.call($routeParams.m) === '[object Array]' ? $routeParams.m : [ $routeParams.m ];
				for(var i=0; i < metrics.length; i++) {

					var arr = metrics[i].match(/^(.*)\{(.*)\}\{alias:(.*),yTransform:(.*)\}$/);
					var met = arr[1].split(":");

					var rate = met.length == 3 ? true: false;
					series.push({
						'alias': arr[3],
						'yTransform': arr[4],
						'query':{
							'aggregator': met[0],
							'rate': rate,
							'metric': met[met.length-1],
							'tags': commaSepStrToDict(arr[2])
						}
					});
				}
			}
			return series;
		}

		function parseAdhocThresholdParams() {
			if($routeParams.thresholds) {
				try {
					var arr = $routeParams.thresholds.split(":");
					if(arr.length == 3) {
						var dmm = arr[0].split("-");
						var wmm = arr[1].split("-");
						var imm = arr[2].split("-");
						return {
							'danger': 	{ max:dmm[0], min:dmm[1] },
							'warning': 	{ max:wmm[0], min:wmm[1] },
							'info': 	{ max:imm[0], min:imm[1] }
						};
					}
				} catch(e) {
					console.warn("cannot set thresholds", e);
				}
			}
			return {
				danger: {max:'', min:''},
				warning: {max:'', min:''},
				info: {max:'', min:''}
			};
		}

		function parseAdhocParams() {

			var gmodel = {};
			gmodel.size 		= $routeParams.size ? $routeParams.size : ADHOC_DEFAULT_GRAPH_SIZE;
			gmodel.thresholds 	= parseAdhocThresholdParams();
			gmodel.graphType 	= $routeParams.type ? $routeParams.type: ADHOC_DEFAULT_GRAPH_TYPE;
			gmodel.series 		= parseAdhocMetricParams();

			return gmodel;
		}

		function parsePageParams() {

			var out = {};
			out.editMode 		= $routeParams.pageId == "new" ? " edit-mode" : "";
			out.updatesEnabled 	= (editMode == " edit-mode" || scope.updatesEnabled == false) ? false : true;


			return out;
		}

		function getParams() {

			switch(scope.modelType) {
				case "adhoc":
					return parseAdhocParams();
					break;
				default:
					return parsePageParams();
					break;
			}
		}

		initialize();

		t.getParams = getParams;

	}
	return (RouteManager);
}])
.factory("URLSetter", ['$location', function($location) {

	var URLSetter = function(scope) {
		var t = this;

		function parseMetrics(obj) {

			var outarr = [];
			for(var s=0; s < obj.series.length; s++) {

				serie = obj.series[s];
				q = serie.query;

				var params = q.aggregator+":";
				if(q.rate) params += "rate:";

				params += q.metric+"{"
				tagstr = "";
				for(var tk in q.tags) {

					if(tk == "") continue;
					tagstr += tk+":"+q.tags[tk]+","
				}

				tagstr.replace(/\,$/,'');
				if(tagstr !== "") params += tagstr;

				params += "}{alias:"+serie.alias;
				params += ",yTransform:"+serie.yTransform+"}";
				outarr.push(params);
			}
			return outarr;
		}

		function setURL(obj) {

			var srch = {
				'm'			: parseMetrics(obj),
				'thresholds': scope.graph.thresholds.danger.max + "-" + scope.graph.thresholds.danger.min +
								":"+scope.graph.thresholds.warning.max + "-" + scope.graph.thresholds.warning.min +
								":"+scope.graph.thresholds.info.max + "-" + scope.graph.thresholds.info.min,
				'type'		: scope.graph.graphType,
				'size'		: scope.graph.size,
			};

			if(scope.editMode === "") srch.editMode = "false";

			if(scope.timeType === "absolute") {

				srch.start = scope.startTime;
				if(scope.endTime) srch.end = scope.endTime;
			} else {

				srch.start = scope.timeType;
			}

			var uAnnoTagsStr = dictToCommaSepStr(scope.globalAnno.tags, ":");

			if(scope.globalAnno.eventTypes.length > 0 && uAnnoTagsStr != "") {

				srch.annotationTypes = scope.globalAnno.eventTypes.join("|");
				srch.annotationTags = uAnnoTagsStr;
			}

			$location.search(srch);
		}

		t.setURL = setURL;
	};

	return (URLSetter);
}])
.factory("ModelManager", ['Model', '$route', '$routeParams', function(Model, $route, $routeParams) {

	var ModelManager = function(scope) {

		function modelManagerErrback(error) {
			if(error.data && Object.prototype.toString.call(error.data) === '[object Object]')
				setGlobalAlerts({
					'error': error.status,
					'message': "code: "+error.status+" "+JSON.stringify(error.data)
				});
			else
				setGlobalAlerts({
					'error': error.status,
					'message': "code: "+error.status+" "+error.data
				});
			flashAlertsBar();
		}

		function _removeModelCallback(rslt) {

			setGlobalAlerts(rslt);
			if(rslt.error) {
				flashAlertsBar();
			} else {

				location.hash = "#/new";

				document.getElementById('side-panel').dispatchEvent(
					new CustomEvent('refresh-model-list', {'detail': 'refresh model list'}));
			}
		}

		function removeModel(callback) {

			Model.removeModel({pageId: scope.model._id}, {}, function(result) {
				_removeModelCallback(result);
			});
		}

		function _saveModelCallback(rslt) {

			if(rslt.error) {
				setGlobalAlerts(rslt);
				flashAlertsBar();
			} else {

				document.getElementById('side-panel').dispatchEvent(
					new CustomEvent('refresh-model-list', {'detail': 'refresh model list'}));

				if($routeParams.pageId === "new") {
					location.hash = "#/" + scope.model._id;
				} else {
					location.reload(true);
				}
			}
		}

		function saveModel(args) {
			if($routeParams.pageId == 'new') {

				Model.saveModel(scope.model,
					function(result) {
						_saveModelCallback(result);
					}, modelManagerErrback);
			} else {

				Model.editModel({'pageId': scope.model._id}, scope.model,
					function(result) {
						_saveModelCallback(result);
					}, modelManagerErrback);
			}
		}

		$.extend(scope, {
			'saveModel': saveModel,
			'removeModel': removeModel
		}, true);

	}

	return (ModelManager);
}])
.factory("WebSocketDataProvider", ['Configuration', function(Configuration) {

	var WebSocketDataProvider = function(scope) {

		var queuedReqs = [];
		var wssock = null;
		var modelGraphIdIdx = {};

		var __queuedEventListeners = {};

		//this is store if a connection action has been initiated by the user//
		var __connectState = "disconnected";

		/*
		 * Re-add event listeners registered by graphs
		 *
		 */
		function reAddGraphEventListeners() {
			for(var k in modelGraphIdIdx) {
				wssock.addEventListener(k, modelGraphIdIdx[k]);
			}
		}

		function getWebSocket(callback) {
			__connectState = "connecting";
			Configuration.getConfig(function(wsConfig) {

				if ("WebSocket" in window) callback(new WebSocket(wsConfig.websocket.uri));
				else if ("MozWebSocket" in window) callback(new MozWebSocket(wsConfig.websocket.uri));
				else callback(null);
			});
		}

		function onOpenWssock() {
			console.log("Connected. Extensions: [" + wssock.extensions + "]");
			console.log("Submitting queued requests:", queuedReqs.length);

			reAddGraphEventListeners();

			while(queuedReqs.length > 0) wssock.send(queuedReqs.shift());
		}

		function onCloseWssock(e) {
			console.log("Disconnected (clean=" + e.wasClean + ", code=" + e.code + ", reason='" + e.reason + "')");
			wssock = null;
			__connectState = "disconnected";
		}

		function onMessageWssock(e) {
			var data = JSON.parse(e.data);
			if(data.error) {

				setGlobalAlerts(data);
				flashAlertsBar();
			} else if(data.annoEvents) {
				// Annotations
				scope.$apply(function(){scope.globalAnno.status = 'dispatching'});

				if(scope.modelType === 'adhoc') {

					data._id = scope.graph._id;
					var ce = new CustomEvent(data._id, {'detail': data });
					wssock.dispatchEvent(ce);
				} else {

					for(var i in modelGraphIdIdx) {
						data._id = i;
						var ce = new CustomEvent(data._id, {'detail': data });
						wssock.dispatchEvent(ce);
					}
				}
				scope.$apply(function(){scope.globalAnno.status = 'dispatched'});
			} else {
				// graph data //
				var ce = new CustomEvent(data._id, {'detail': data });
				wssock.dispatchEvent(ce);
			}
		}

		function _addGraphIdEventListener(graphId, funct) {
			wssock.addEventListener(graphId, funct);

			modelGraphIdIdx[graphId] = funct;

			if(Object.keys(modelGraphIdIdx).length === scope.modelGraphIds.length) {
				// trigger annotation request as all graph elems are loaded //
				scope.globalAnno.status = 'load';
			}
		}

		function initializeWebSocket() {
			getWebSocket(function(ws) {

				wssock = ws;
				if(wssock !== null) {
					wssock.onopen 		= onOpenWssock;
					wssock.onclose 		= onCloseWssock;
					wssock.onmessage 	= onMessageWssock;

					__connectState = "connected";

					for(k in __queuedEventListeners) {
						_addGraphIdEventListener(k, __queuedEventListeners[k]);
						delete __queuedEventListeners[k];
					}
				} else {
					console.error("Null websocket");
				}
			});
		}

		this.addGraphIdEventListener = function(graphId, funct) {
			if (wssock != null) {
				_addGraphIdEventListener(graphId, funct);
			} else {
				console.log("Queueing event listener:", graphId);
				__queuedEventListeners[graphId] = funct;
			}
		}

		this.removeGraphIdEventListener = function(graphId, funct) {
			if(wssock !== null) wssock.removeEventListener(graphId, funct);
		}
		this.requestData = function(query) {
			try {
				wssock.send(JSON.stringify(query));
			} catch(e) {

				if(e.code === 11) {
					queuedReqs.push(JSON.stringify(query));
				} else {
					//console.log(e);
					console.log("iConnect state: " + __connectState);
					//reconnect
					queuedReqs.push(JSON.stringify(query));
					/* only reconnect if there are no connection actions in progress */
					if(__connectState === "disconnected") {
						console.log("Re-connecting...");
						initializeWebSocket();
					} else {
						console.log("Waiting for connection establishment")
					}
				}
			}
		}
		this.closeConnection = function() {
			wssock.close();
		}

		initializeWebSocket();
	}
	return (WebSocketDataProvider);
}]);
