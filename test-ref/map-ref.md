<title>Leaflet Map</title>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
<style>
        #map {
            height: 740px;
            width: 100%;
        }
        .leaflet-container .leaflet-control-attribution {
            display: none !important;
        }
        .leaflet-left {
            display: none !important;        
        }   
       .leaflet-bar  {
       background-color: rgba(0, 0, 0, 0.1);
       border-radius: 18px;
       border: solid rgba(0, 0, 0, 0.1) !important;
       }
       
       .leaflet-control-zoom-in {
       background-color: #fff !important;
       border-radius: 7px !important; 
       padding: 5px !important;  
       padding-bottom: 9px !important;               
        }
                                        
       .leaflet-control-zoom-out {
       background-color: #fff !important;
       border-radius: 7px !important; 
       padding: 5px !important;  
       padding-bottom: 9px !important;     
        }    
                                                                        
        /* Additional custom styles */
        .leaflet-popup-content-wrapper {
            background-color: white;
            margin-bottom: -13px;            
            padding: 0;            
            border-radius: 18px;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        }
        .leaflet-popup-content b {
            font-family: Magistral, sans-serif;
            color: #333;
        }        
        .leaflet-popup-content {
            font-family: Magistral, sans-serif;
            color: #333;
            padding: 10px;
        }
        .leaflet-popup-tip {
            background: white;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);            
        }
        .leaflet-marker-icon {
            background-color: transparent;
        }
        .leaflet-marker-icon:hover {
            background-color: transparent;
        }   
        .leaflet-marker-icon:active {
            background-color: transparent;
        }
        .leaflet-marker-icon .leaflet-zoom-animated .leaflet-interactive {
            background-color: transparent;
        }   

        @import url('https://fonts.googleapis.com/css?family=Open+Sans');
        
        a {
        color: black !important;
        text-decoration: none;
        font-size: 16px;
        font-family: "Open Sans", sans-serif;
        text-decoration: none !important;

        }
                         
                                               
    </style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
<script>
        // Initialize the map and set its view to the specified coordinates and zoom level
        var map = L.map('map', {
            center: [64.17632407951727, -51.73863417907605], 
            zoom: 15, // Increased zoom level
            minZoom: 13, // Set the minimum zoom level            
            dragging: false, // Disable dragging
            scrollWheelZoom: false, // Disable scroll wheel zoom
            doubleClickZoom: false, // Disable double click zoom
            touchZoom: false, // Disable touch zoom
            boxZoom: false, // Disable box zoom
            keyboard: false // Disable keyboard navigation
        });

        // Add a tile layer to the map (using OpenStreetMap tiles)
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
	subdomains: 'abcd'
}).addTo(map);

        // Add a custom zoom control positioned on the right
        L.control.zoom({
            position: 'topright'
        }).addTo(map);

        // Define a custom icon using an alternative icon from Icons8
        var LocationIcon = L.icon({
            iconUrl: 'https://img.icons8.com/?size=100&id=7880&format=png&color=ff8e00', // Alternative custom icon URL
            iconSize: [40, 40], // Size of the icon
            iconAnchor: [31, 34], // Anchor point of the icon (middle of the bottom)
            popupAnchor: [-10, -32] // Point from which the popup should open relative to the iconAnchor
        });

        // Add a marker with the custom icon to the specified coordinates
        L.marker([64.17632407951727, -51.73863417907605], {icon: LocationIcon}).addTo(map)
          .bindPopup('<b>Hotel Nuuk</b><br><a>Imaneq 23, B-3152</a>')
          .openPopup();
  </script>