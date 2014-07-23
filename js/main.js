//
// Commons
//

var startDate,
	endDate,
	initialPosition,
	spatialPoints = [],
	entities = {};

function entity() {

	// Setters
	this.id = function(_) {
      if (!arguments.length) return id;
      id = _;
      return this;
    };

    this.points = function(_) {
      if (!arguments.length) return points;
      points = _;
      return this;
    };

}

//
// Helpers
//

function formatDate(date) {
	return d3.time.format("%Y-%m-%d %H:%M:%S").parse(date);
}

function print_filter(filter){
	var f=eval(filter);
	if (typeof(f.length) != "undefined") {}else{}
	if (typeof(f.top) != "undefined") {f=f.top(Infinity);}else{}
	if (typeof(f.dimension) != "undefined") {f=f.dimension(function(d) { return "";}).top(Infinity);}else{}
	console.log(filter+"("+f.length+") = "+JSON.stringify(f).replace("[","[\n\t").replace(/}\,/g,"},\n\t").replace("]","\n]"));
}

//
// Setup
//

minDate = formatDate("2008-10-28 00:00:00");
maxDate = formatDate("2008-10-28 23:59:59");
startDate = formatDate("2008-10-28 07:00:00");
endDate = formatDate("2008-10-28 13:00:46");
initialPosition = [39.94403, 116.407526]; // beijing

//
// Slider
//

var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];

$("#slider").dateRangeSlider({
	bounds: {min: minDate, max: maxDate},
	defaultValues: {min: startDate, max: endDate},
	wheelMode: "scroll",
	wheelSpeed: 1,
	step: {
	    minutes: 1
	},
	formatter:function(val){
		var format = d3.time.format("%Y-%m-%d %H:%M");
		return format(val);
		alert("STUF");
	}
});

/*,
scales: [{
  first: function(value){ return value; },
  end: function(value) {return value; },
  next: function(value){
    var next = new Date(value);
    return new Date(next.setMonth(value.getMonth() + 1));
  },
  label: function(value){
    return months[value.getMonth()];
  },
  format: function(tickContainer, tickStart, tickEnd){
    tickContainer.addClass("myCustomClass");
  }
}]*/

d3.csv("csv/10-all-5min.csv", function(collection) {

	spatialPoints = [];

	function convertTimestampToUTCDate(timestampInSeconds) {
		var targetTime = new Date(timestampInSeconds*1000);
		return new Date(targetTime.getUTCFullYear(), targetTime.getUTCMonth(), targetTime.getUTCDate(),  targetTime.getUTCHours(), targetTime.getUTCMinutes(), targetTime.getUTCSeconds());
	}

	// Add a LatLng object to each item in the dataset
	collection.forEach(function(d) {
		spatialPoints.push({
			coordinates: new L.LatLng(d.lat, d.lng),
			date: convertTimestampToUTCDate(d.timestamp),
			user: parseInt(d.user)
		});
	});

	$("#slider").bind("valuesChanging", function(e, data){
		updatePointsWithRange([data.values.min, data.values.max]);
	});

	//
	// CROSSFILTER
	//

	var spatial = crossfilter(spatialPoints),
		all = spatial.groupAll(),
		dateDimension = spatial.dimension(function (d) { return d.date; }),
		usersDimension = spatial.dimension(function(d) { return d.user; }),
		usersGroup = usersDimension.group(),
		users = [];

	getDistinctUsers();

	function filterSpatialPointsWithRange(range) {
		entities = {};
		dateDimension.filterRange(range);
		dateDimension.top(Infinity).forEach(function (d) {
			// First time
			if (!entities[d.user]) {
				entities[d.user] = [];
			}
			// Add point to entity
			entities[d.user].push(d.coordinates);
		});
	}

	function getDistinctUsers() {
		usersGroup.top(Infinity).forEach(function (d) {
			users.push({user: d.key});
		});
	}

	// Count total number of points
	var n = all.reduceCount().value();
	console.log("There are " + n + " points in total.");

	//
	// MAP
	//

	var map = L.map('map').setView(initialPosition, 11),
		maplink = L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
						attribution: '&copy; <a href="http://openstreetmap.org">OpenStreetMap</a>',
						maxZoom: 18,
					}).addTo(map);

	// Initialize the SVG layer */
	map._initPathRoot();

	// Pick up the SVG from the map object */
	var svg = d3.select("#map").select("svg"),
		mapTrails = svg.append("g"),
		mapPoints = svg.append("g");

	// Use Leaflet to implement a D3 geometric transformation.
	function projectPoint(x, y) {
		var point = map.latLngToLayerPoint(new L.LatLng(x, y));
		this.stream.point(point.x, point.y);
	}

	var transform = d3.geo.transform({point: projectPoint}),
		path = d3.geo.path().projection(transform);

	//
	// Points
	//


	filterSpatialPointsWithRange([startDate, endDate]);

	var pointers = mapPoints
		.selectAll("circle")
		.data(users)
		.enter()
		.append("circle")
		.attr("r", 5)
		.attr("fill", "purple")
		.attr("fill-opacity", 1)
		.attr("stroke", "black")
		.attr("stroke-width", 2)
		.attr("stroke-opacity", 1)
		.attr("opacity", 1)
		;

	var trails = mapTrails
		.selectAll("path")
		.data(users)
		.enter()
		.append("path")
		.attr("fill", "none")
        .attr("stroke", "#842DCE")
        .attr("stroke-width", 3)
        ;

	function render() {
		pointers.attr("transform", function (d) {
			var coordinates = entities[d.user];
			if (coordinates && coordinates.length>0) {
				var header = coordinates[0];
				return "translate("+
					map.latLngToLayerPoint(header).x +","+
					map.latLngToLayerPoint(header).y +")";
			} else {
				return "translate(-5,-5)";
			}
		});
		trails.attr("d", function (d) {
			var coordinates = entities[d.user];
			if (coordinates && coordinates.length>0) {
				return path({type: "LineString", coordinates: convertToArrayXY(coordinates)});
			} else {
				return "M0,0";
			}
		});
	}

	function updateOnResize() {
		render();
	}

	function updatePointsWithRange(range) {
		filterSpatialPointsWithRange(range);
		render();
	}

	function convertToArrayXY(coordinates) {
		var array = [];
		coordinates.forEach(function(d) {
			array.push([d.lat, d.lng]);
		});
		return array;
	}

	map.on("viewreset", updateOnResize);
	updateOnResize();

});