// Call the mapa
var map = L.map('mapid').setView([51.505, -0.09], 13);

L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw', {
    maxZoom: 18,
    attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
        '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
        'Imagery © <a href="http://mapbox.com">Mapbox</a>',
    id: 'mapbox.streets'
}).addTo(map);

var marker1 = L.marker([51.5, -0.09]);
marker1.addTo(map);
setTimeout(function() { marker1.removeFrom(map); }, 2500);

setTimeout(function() {
    var marker2 = L.marker([51.5, -0.08]);
    marker2.addTo(map);
    setTimeout(function() { marker2.removeFrom(map); }, 1500);
}, 500);
