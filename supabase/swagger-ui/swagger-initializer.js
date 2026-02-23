window.onload = function() {
  window.ui = SwaggerUIBundle({
    url: "../openapi.json",  // <-- metti qui il path del tuo file
    dom_id: '#swagger-ui',
    presets: [
      SwaggerUIBundle.presets.apis,
      SwaggerUIStandalonePreset
    ],
    layout: "StandaloneLayout"
  })
}
