import SwaggerUI from 'swagger-ui-react'
import 'swagger-ui-react/swagger-ui.css'

// Copia qui il JSON generato dalla tua edge function,
// oppure fetchalo dinamicamente (vedi sotto)
import apiSpec from './openapi.json'

export default function ApiDocs() {
  return (
    <div className="p-4">
      <SwaggerUI spec={apiSpec} />
    </div>
  )
}
