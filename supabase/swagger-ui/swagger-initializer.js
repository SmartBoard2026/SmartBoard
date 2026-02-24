window.onload = function() {
  window.ui = SwaggerUIBundle({
    urls: [
      { url: "https://gdiaotelevhqmesamrnx.supabase.co/functions/v1/create-game/openapi.json", name: "Create Game" },
      { url: "https://gdiaotelevhqmesamrnx.supabase.co/functions/v1/get-games/openapi.json",   name: "Get Games"   },
      { url: "https://gdiaotelevhqmesamrnx.supabase.co/functions/v1/resign-game/openapi.json", name: "Resign Game" },
      { url: "https://gdiaotelevhqmesamrnx.supabase.co/functions/v1/submit-move/openapi.json", name: "Submit Move" },
    ],
    "urls.primaryName": "Create Game",
    dom_id: '#swagger-ui',
    presets: [
      SwaggerUIBundle.presets.apis,
      SwaggerUIStandalonePreset
    ],
    layout: "StandaloneLayout"
  })
}
