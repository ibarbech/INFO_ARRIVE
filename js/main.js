var endpointCC = "http://opendata.caceres.es/sparql/";
var queryGraph = "";

var routes = {};
var routeType = "";
var currentRoute = "";

var map;
var routeGeoJSON = {};
var markers = [];

var prev_infowindow = false;

var directionsService;
var directionsDisplay;

var curMarkers = [];
var lastMarker;
var posMarker;
var cityCircle = null;

function getAndProcessData(location, cur_uri) {
	var y = document.getElementById("sliderValue");
	var radius = parseInt(y.value) / 1000;
	var cur_lat = location.lat();
	var cur_long = location.lng();
	var sparqlQuery = "SELECT ?name ?label ?tipoAparcamiento ?nombre_via ?tipo_via  ?geo_long ?geo_lat ?distance " +
	"WHERE { " +
	"  { " +
	"    select ?name ?label ?tipoAparcamiento ?nombre_via ?tipo_via ?geo_long ?geo_lat min((bif:st_distance(bif:st_point(?geo_lat,?geo_long),bif:st_point( " + cur_lat + ", " +cur_long + " )))) AS ?distance " +
	"    where{ " +
	"          ?URI a " + cur_uri + ". " +
	"          ?URI geo:lat ?geo_lat. " +
	"          ?URI geo:long ?geo_long. " +
	"          OPTIONAL {?URI foaf:name ?name. } " +
	"          OPTIONAL {?URI rdfs:label ?label. } " +
	"          OPTIONAL {?URI om:tipoAparcamiento ?tipoAparcamiento. } " +
	"          OPTIONAL {?URI om:situadoEnVia ?uri_via. " +
	"                              ?uri_via rdfs:label ?nombre_via. " +
	"                              ?uri_via om:tipoVia ?tipo_via. " +
	"                              } " +
	"    } " +
	"    ORDER BY ASC(?distance) " +
	"  } " +
	"  FILTER (?distance < " + radius + ") " +
	"} "

	console.log(sparqlQuery);

	$.ajax({
		data : {
			"default-graph-uri" : queryGraph,
			query : sparqlQuery,
			format : 'json'
		},
		url : endpointCC,
		cache : false,
		statusCode : {
			400 : function(error) {
				alert("ERROR");
				console.log("Error	");
			}
		},
		success : function(data) {
			//processRoutes(data);
			processData(data,cur_uri);
			console.log("Correcto");
		}
	});

}

function printValue(sliderID, textbox) {
	var x = document.getElementById(textbox);
	var y = document.getElementById(sliderID);
	x.value = y.value;

	if (cityCircle != null)
		cityCircle.setRadius(parseInt(y.value));

	updateSites();

}

function init(type) {

	document.getElementById("selectDistance").options.selectedIndex = 0;

	routeType = type;

	hideSelector();
	document.getElementById("infoMonument").style.display = "none";

}

function processData(data, cur_uri) {
	var bindings = data.results.bindings;
	var element;
	var distance;
	// console.log(bindings.length)
	for (element in bindings) {
		if (bindings.hasOwnProperty(element))
		{
			if (bindings[element].distance.value != undefined)
			{
				distance = bindings[element].distance.value;
			}
			var shouldCreateRoute=false;
			var pathIcon = ""
			var label = ""
			var cur_title = ""
			switch(cur_uri) {
			    case "om:ParadaTaxi":
			        pathIcon = "images/taxiIcon.png";
							shouldCreateRoute  = false;
							label = bindings[element].tipo_via.value + " " + bindings[element].nombre_via.value;
							cur_title = bindings[element].tipo_via.value + " " + bindings[element].nombre_via.value
			        break;
			    case "om:AparcamientoPublico":
							pathIcon = "images/parkingIcon.png";
							shouldCreateRoute  = true;
							label = bindings[element].label.value;
							cur_title = bindings[element].label.value
			        break;
			    case "gtfs:Stop":
							pathIcon = "images/busIcon.png";
							shouldCreateRoute  = false;
							label = bindings[element].name.value;
							cur_title = bindings[element].name.value
			        break;
					case "om:Monumento":
							pathIcon = "images/monumentIcon.png";
							shouldCreateRoute  = true;
							label = bindings[element].label.value;
							cur_title = bindings[element].label.value
							break;
			    default:
							pathIcon = null;
							shouldCreateRoute  = false;
							label = "Recurso de tipo " + cur_uri + "\n";
							cur_title = "Recurso de tipo " + cur_uri + "\n";
							if (bindings[element].label.value != undefined)
							{
								label += bindings[element].label.value;
								cur_title += bindings[element].label.value;
							}
							else if (bindings[element].name.value != undefined)
							{
								label += bindings[element].name.value;
								cur_title += bindings[element].name.value;
							}
			}
			var marker = new google.maps.Marker(
				{
					position : {
						lat : parseFloat(bindings[element].geo_lat.value),
						lng : parseFloat(bindings[element].geo_long.value)
					},
					title : cur_title,
					clickable : true
				});

			marker.info = new google.maps.InfoWindow({
				content : label
			});
			if(shouldCreateRoute){
				google.maps.event.addListener(marker, "click", function() {
					//alert(this.html);
					calculateAndDisplayRoute(directionsService, directionsDisplay, posMarker.position, this.position, "DRIVING", "Ruta en coche:");
					this.info.open(map, this);
				});
			}
			if(pathIcon != null)
			{
				var icon = {
					url : pathIcon, // url
					scaledSize : new google.maps.Size(50, 50), // scaled size
					origin : new google.maps.Point(0, 0), // origin
					anchor : new google.maps.Point(15, 15) // anchor
				};
				marker.setIcon(icon);
			}
			marker.setMap(map);
			curMarkers.push(marker);
		}
		// console.log(distance);
	}
}

function initMap() {

	directionsService = new google.maps.DirectionsService;
	directionsDisplay = new google.maps.DirectionsRenderer;

	var mapZoom = 6;
	var mapCenter = {
		lat : 39.475088,
		lng : -6.371472
	};

	map = new google.maps.Map(document.getElementById('map'), {
		center : {
			lat : 40.4378698,
			lng : -3.8196207
		},
		zoom : 6
	});
	directionsDisplay.setMap(map);
	/**
	 var infoWindow = new google.maps.InfoWindow({
	 map : map
	 });
	 **/

	// Try HTML5 geolocation.
	if (navigator.geolocation) {
		navigator.geolocation.getCurrentPosition(function(position) {
			var pos = {
				lat : position.coords.latitude,
				lng : position.coords.longitude
			};

			posMarker = new google.maps.Marker({
				position : pos,
				title : "Estoy aqui"
			});
			map.setZoom(12);
			posMarker.setMap(map);

			lastMarker = new google.maps.Marker({
				position : pos,
				title : "Estoy aqui"
			});
			map.setZoom(12);
			lastMarker.setMap(map);

			//infoWindow.setPosition(pos);
			//infoWindow.setContent('Estás aqui');
			map.setCenter(pos);
		}, function() {
			handleLocationError(true, infoWindow, map.getCenter());
		});
	} else {
		// Browser doesn't support Geolocation
		handleLocationError(false, infoWindow, map.getCenter());
	}

	google.maps.event.addListener(map, 'click', function(event) {
		placeMarker(event.latLng);
	});

	lastMarker = new google.maps.Marker({
		position : pos,
		title : "Estoy aqui"
	});
	lastMarker.setMap(map);

}

function placeMarker(location) {
	lastMarker.setMap(null);
	lastMarker = new google.maps.Marker({
		position : location,
		title : "Estoy aqui"
	});

	//Circulo
	if (cityCircle != null)
		cityCircle.setMap(null);

	cityCircle = new google.maps.Circle({
		strokeColor : '#FF0000',
		strokeOpacity : 0.8,
		strokeWeight : 2,
		fillColor : '#FF0000',
		fillOpacity : 0.35,
		map : map,
		center : location,
		radius : 100
	});

	google.maps.event.addListener(cityCircle, 'click', function(event) {
		placeMarker(event.latLng);
	});



	var y = document.getElementById("sliderValue");

	cityCircle.setRadius(parseInt(y.value));

	//Fin circulo

	lastMarker.setMap(map);

	map.setCenter(lastMarker.position);

	updateSites();

}

function calculateAndDisplayRoute(directionsService, directionsDisplay, origin, destination, travelMode,text) {
	directionsService.route({
		origin : origin,
		destination : destination,
		travelMode : travelMode
	}, function(response, status) {
		if (status === 'OK') {
			directionsDisplay.setDirections(response);
			var step = 1;
			var infowindow2 = new google.maps.InfoWindow();
			infowindow2.setContent("<b>"+text+"</b>"+"<br/>"+response.routes[0].legs[0].distance.text + "<br>" + response.routes[0].legs[0].steps[step].duration.text + " ");
			infowindow2.setPosition(response.routes[0].legs[0].end_location);
			infowindow2.open(map);
		} else {
			window.alert('Directions request failed due to ' + status);
		}
	});
}

function updateSites() {

	var location = lastMarker.position;

	for (var i = 0; i < curMarkers.length; i++) {
		curMarkers[i].setMap(null);
	}
	if (document.getElementById('newDataset').value != "")
	{
		getAndProcessData(location, document.getElementById('newDataset').value)
	}
	if (document.getElementById('chkParkings').checked) {
		getAndProcessData(location, "om:AparcamientoPublico");
	}
	if (document.getElementById('chkBusStops').checked) {
		getAndProcessData(location, "gtfs:Stop");
	}
	if (document.getElementById('chkTaxiStops').checked) {
		getAndProcessData(location, "om:ParadaTaxi");
	}
	if (document.getElementById('chkMonuments').checked) {
		getAndProcessData(location, "om:Monumento");
	}

}

function fitBounds() {

	// Establecer zoom y límites del mapa
	var bounds = new google.maps.LatLngBounds();
	var cantidad = 0;

	map.data.forEach(function(feature) {
		processPoints(feature.getGeometry(), bounds.extend, bounds);
		cantidad++;
	});

	for (var j = 0; j < markers.length; j++) {
		bounds.extend(markers[j].getPosition());
		cantidad++;
	}

	if (cantidad > 0) {
		map.fitBounds(bounds);
	}
}

function changeStyle() {
	map.data.setStyle({

		clickable : false,

		strokeColor : 'MidnightBlue',
		fillColor : 'DodgerBlue',
		strokeOpacity : '1.0',
		strokeWeight : 2
	});
}

function processPoints(geometry, callback, thisArg) {
	if ( geometry instanceof google.maps.LatLng) {
		callback.call(thisArg, geometry);
	} else if ( geometry instanceof google.maps.Data.Point) {
		callback.call(thisArg, geometry.get());
	} else {
		geometry.getArray().forEach(function(g) {
			processPoints(g, callback, thisArg);
		});
	}
}

function mapButtonAction() {

	var mapButtonSection = document.getElementById("mapButtonSection");
	var mapButton = document.getElementById("mapButton");
	var infoSection = document.getElementById("info");
	var contentMap = document.getElementById("contentMap");
	var content = document.getElementsByClassName("content")[0];
	var map = document.getElementById("map");

	if (mapButton.innerHTML == "Ampliar mapa") {
		infoSection.style.display = "none";
		map.style.height = "100%";
		mapButton.innerHTML = "Reducir mapa";
		//mapButtonSection.style.top = "135px";
		//mapButtonSection.style.bottom = "auto";

		contentMap.style.height = "calc(100% - 45px)";

	} else if (mapButton.innerHTML == "Reducir mapa") {
		infoSection.style.display = "";
		map.style.height = "";
		mapButton.innerHTML = "Ampliar mapa";
		//mapButtonSection.style.top = "370px";
		//mapButtonSection.style.bottom = "auto";

		contentMap.style.height = "calc(100% - 140px)";
	}

	initMap();
	setMarkers();
}

function showSelector() {

	var selector = document.getElementById('selector');

	if (selector.style.display == "none" || selector.style.display == "") {
		selector.style.display = "block";
	} else if (selector.style.display == "block") {
		selector.style.display = "";
	}
}

function hideSelector() {
	var mq = window.matchMedia("(min-width: 730px)");

	if (!mq.matches) {
		var selector = document.getElementById("selector");
		selector.style.display = "none";
	}
}
