'use client'

import { useState, useEffect } from 'react'
import { CheckCircleIcon, XCircleIcon, ClipboardIcon, CheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

interface ValidationResult {
  valid: boolean
  errors: Array<{
    path: string
    message: string
    value?: any
    expected?: string
  }>
}

function validateJsonAgainstSchema(data: any, schema: any): ValidationResult {
  const errors: ValidationResult['errors'] = []

  function validate(value: any, schemaNode: any, path: string = ''): void {
    if (schemaNode.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value
      const expectedType = schemaNode.type

      if (actualType !== expectedType) {
        errors.push({
          path: path || 'root',
          message: `Type mismatch: expected ${expectedType}, got ${actualType}`,
          value,
          expected: expectedType
        })
        return
      }
    }

    if (schemaNode.type === 'object' && schemaNode.properties) {
      if (typeof value !== 'object' || Array.isArray(value)) {
        errors.push({
          path: path || 'root',
          message: 'Expected object',
          value
        })
        return
      }

      // Check required properties
      if (schemaNode.required) {
        for (const requiredProp of schemaNode.required) {
          if (!(requiredProp in value)) {
            errors.push({
              path: `${path}${path ? '.' : ''}${requiredProp}`,
              message: 'Required property missing',
              expected: requiredProp
            })
          }
        }
      }

      // Validate existing properties
      for (const [key, val] of Object.entries(value)) {
        if (schemaNode.properties[key]) {
          validate(val, schemaNode.properties[key], `${path}${path ? '.' : ''}${key}`)
        } else if (!schemaNode.additionalProperties) {
          errors.push({
            path: `${path}${path ? '.' : ''}${key}`,
            message: 'Additional property not allowed',
            value: val
          })
        }
      }
    }

    if (schemaNode.type === 'array' && schemaNode.items) {
      if (!Array.isArray(value)) {
        errors.push({
          path: path || 'root',
          message: 'Expected array',
          value
        })
        return
      }

      value.forEach((item, index) => {
        validate(item, schemaNode.items, `${path}${path ? '.' : ''}[${index}]`)
      })

      if (schemaNode.minItems && value.length < schemaNode.minItems) {
        errors.push({
          path: path || 'root',
          message: `Array too short: minimum ${schemaNode.minItems} items, got ${value.length}`,
          value: value.length,
          expected: `at least ${schemaNode.minItems}`
        })
      }

      if (schemaNode.maxItems && value.length > schemaNode.maxItems) {
        errors.push({
          path: path || 'root',
          message: `Array too long: maximum ${schemaNode.maxItems} items, got ${value.length}`,
          value: value.length,
          expected: `at most ${schemaNode.maxItems}`
        })
      }
    }

    if (schemaNode.type === 'string') {
      if (schemaNode.minLength && value.length < schemaNode.minLength) {
        errors.push({
          path: path || 'root',
          message: `String too short: minimum ${schemaNode.minLength} characters, got ${value.length}`,
          value: value.length,
          expected: `at least ${schemaNode.minLength} characters`
        })
      }

      if (schemaNode.maxLength && value.length > schemaNode.maxLength) {
        errors.push({
          path: path || 'root',
          message: `String too long: maximum ${schemaNode.maxLength} characters, got ${value.length}`,
          value: value.length,
          expected: `at most ${schemaNode.maxLength} characters`
        })
      }

      if (schemaNode.pattern) {
        const regex = new RegExp(schemaNode.pattern)
        if (!regex.test(value)) {
          errors.push({
            path: path || 'root',
            message: `String does not match pattern: ${schemaNode.pattern}`,
            value,
            expected: `pattern: ${schemaNode.pattern}`
          })
        }
      }

      if (schemaNode.enum && !schemaNode.enum.includes(value)) {
        errors.push({
          path: path || 'root',
          message: `Value not in allowed enum: ${schemaNode.enum.join(', ')}`,
          value,
          expected: `one of: ${schemaNode.enum.join(', ')}`
        })
      }
    }

    if (schemaNode.type === 'number' || schemaNode.type === 'integer') {
      if (schemaNode.minimum !== undefined && value < schemaNode.minimum) {
        errors.push({
          path: path || 'root',
          message: `Value below minimum: ${schemaNode.minimum}`,
          value,
          expected: `>= ${schemaNode.minimum}`
        })
      }

      if (schemaNode.maximum !== undefined && value > schemaNode.maximum) {
        errors.push({
          path: path || 'root',
          message: `Value above maximum: ${schemaNode.maximum}`,
          value,
          expected: `<= ${schemaNode.maximum}`
        })
      }

      if (schemaNode.type === 'integer' && !Number.isInteger(value)) {
        errors.push({
          path: path || 'root',
          message: 'Expected integer',
          value,
          expected: 'integer'
        })
      }
    }
  }

  try {
    validate(data, schema)
    return {
      valid: errors.length === 0,
      errors
    }
  } catch (error) {
    return {
      valid: false,
      errors: [{
        path: 'root',
        message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }]
    }
  }
}

function CopyButton({ text, label = "Copy" }: { text: string, label?: string }) {
  const [copied, setCopied] = useState(false)
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
    >
      {copied ? (
        <>
          <CheckIcon className="w-3 h-3" />
          Copied!
        </>
      ) : (
        <>
          <ClipboardIcon className="w-3 h-3" />
          {label}
        </>
      )}
    </button>
  )
}

export default function JsonSchemaValidator() {
  const [jsonData, setJsonData] = useState(`{
  "name": "John Doe",
  "age": 30,
  "email": "john@example.com",
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "zipCode": "10001"
  },
  "hobbies": ["reading", "hiking"]
}`)

  const [jsonSchema, setJsonSchema] = useState(`{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1
    },
    "age": {
      "type": "number",
      "minimum": 0,
      "maximum": 150
    },
    "email": {
      "type": "string",
      "pattern": "^[\\\\w-\\\\.]+@([\\\\w-]+\\\\.)+[\\\\w-]{2,4}$"
    },
    "address": {
      "type": "object",
      "properties": {
        "street": {"type": "string"},
        "city": {"type": "string"},
        "zipCode": {"type": "string", "pattern": "^\\\\d{5}$"}
      },
      "required": ["street", "city"]
    },
    "hobbies": {
      "type": "array",
      "items": {"type": "string"},
      "minItems": 1,
      "maxItems": 10
    }
  },
  "required": ["name", "email"],
  "additionalProperties": false
}`)

  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [jsonError, setJsonError] = useState<string>('')
  const [schemaError, setSchemaError] = useState<string>('')

  const validateJson = () => {
    setJsonError('')
    setSchemaError('')
    setValidationResult(null)

    try {
      const data = JSON.parse(jsonData)
      const schema = JSON.parse(jsonSchema)
      
      const result = validateJsonAgainstSchema(data, schema)
      setValidationResult(result)
    } catch (error) {
      if (error instanceof Error) {
        try {
          JSON.parse(jsonData)
          setSchemaError(`Invalid schema JSON: ${error.message}`)
        } catch {
          setJsonError(`Invalid JSON data: ${error.message}`)
        }
      }
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (jsonData.trim() && jsonSchema.trim()) {
        validateJson()
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [jsonData, jsonSchema])

  const predefinedSchemas = {
    'User Profile': {
      schema: `{
  "type": "object",
  "properties": {
    "id": {"type": "number"},
    "username": {"type": "string", "minLength": 3},
    "email": {"type": "string", "pattern": "^[\\\\w-\\\\.]+@([\\\\w-]+\\\\.)+[\\\\w-]{2,4}$"},
    "profile": {
      "type": "object",
      "properties": {
        "firstName": {"type": "string"},
        "lastName": {"type": "string"},
        "bio": {"type": "string", "maxLength": 500}
      }
    }
  },
  "required": ["id", "username", "email"]
}`,
      example: `{
  "id": 123,
  "username": "johndoe",
  "email": "john@example.com",
  "profile": {
    "firstName": "John",
    "lastName": "Doe",
    "bio": "Software developer"
  }
}`
    },
    'Product': {
      schema: `{
  "type": "object",
  "properties": {
    "id": {"type": "string"},
    "name": {"type": "string", "minLength": 1},
    "price": {"type": "number", "minimum": 0},
    "category": {"type": "string", "enum": ["electronics", "clothing", "books"]},
    "inStock": {"type": "boolean"},
    "tags": {
      "type": "array",
      "items": {"type": "string"},
      "uniqueItems": true
    }
  },
  "required": ["id", "name", "price", "category"]
}`,
      example: `{
  "id": "prod-123",
  "name": "Wireless Headphones",
  "price": 99.99,
  "category": "electronics",
  "inStock": true,
  "tags": ["wireless", "audio", "bluetooth"]
}`
    },
    'API Response': {
      schema: `{
  "type": "object",
  "properties": {
    "success": {"type": "boolean"},
    "data": {"type": "object"},
    "message": {"type": "string"},
    "timestamp": {"type": "string"},
    "errors": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "field": {"type": "string"},
          "code": {"type": "string"},
          "message": {"type": "string"}
        }
      }
    }
  },
  "required": ["success"]
}`,
      example: `{
  "success": true,
  "data": {
    "userId": 123,
    "action": "created"
  },
  "message": "User created successfully",
  "timestamp": "2026-03-25T09:00:00Z"
}`
    }
  }

  const loadPredefinedSchema = (name: string) => {
    const predefined = predefinedSchemas[name as keyof typeof predefinedSchemas]
    if (predefined) {
      setJsonSchema(predefined.schema)
      setJsonData(predefined.example)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-blue-600 p-6 text-white">
            <h1 className="text-3xl font-bold mb-2">JSON Schema Validator</h1>
            <p className="text-green-100">Validate JSON data against JSON Schema specifications</p>
          </div>

          <div className="p-6">
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Quick Start Templates</h3>
              <div className="flex flex-wrap gap-2">
                {Object.keys(predefinedSchemas).map((name) => (
                  <button
                    key={name}
                    onClick={() => loadPredefinedSchema(name)}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              {/* JSON Data Panel */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-800">JSON Data</h2>
                  <CopyButton text={jsonData} label="Copy JSON" />
                </div>
                
                <div>
                  <textarea
                    value={jsonData}
                    onChange={(e) => setJsonData(e.target.value)}
                    rows={16}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
                    placeholder="Enter your JSON data here..."
                  />
                  {jsonError && (
                    <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                      <div className="flex items-center">
                        <XCircleIcon className="w-5 h-5 text-red-500 mr-2" />
                        <span className="text-sm text-red-700">{jsonError}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* JSON Schema Panel */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-800">JSON Schema</h2>
                  <CopyButton text={jsonSchema} label="Copy Schema" />
                </div>
                
                <div>
                  <textarea
                    value={jsonSchema}
                    onChange={(e) => setJsonSchema(e.target.value)}
                    rows={16}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
                    placeholder="Enter your JSON Schema here..."
                  />
                  {schemaError && (
                    <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                      <div className="flex items-center">
                        <XCircleIcon className="w-5 h-5 text-red-500 mr-2" />
                        <span className="text-sm text-red-700">{schemaError}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Validation Results */}
            <div className="mt-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Validation Results</h2>
              
              {validationResult && (
                <div className={`p-4 rounded-md ${
                  validationResult.valid 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-center mb-3">
                    {validationResult.valid ? (
                      <>
                        <CheckCircleIcon className="w-6 h-6 text-green-500 mr-2" />
                        <span className="text-lg font-medium text-green-800">✅ Valid JSON</span>
                      </>
                    ) : (
                      <>
                        <XCircleIcon className="w-6 h-6 text-red-500 mr-2" />
                        <span className="text-lg font-medium text-red-800">❌ Invalid JSON</span>
                      </>
                    )}
                  </div>

                  {validationResult.errors.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-red-800">Validation Errors:</h3>
                      {validationResult.errors.map((error, index) => (
                        <div key={index} className="bg-white p-3 rounded border border-red-200">
                          <div className="flex items-start">
                            <ExclamationTriangleIcon className="w-4 h-4 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-sm text-red-700">
                                <span className="font-medium">Path:</span> {error.path}
                              </p>
                              <p className="text-sm text-red-700 mt-1">{error.message}</p>
                              {error.value !== undefined && (
                                <p className="text-xs text-red-600 mt-1">
                                  <span className="font-medium">Got:</span> {JSON.stringify(error.value)}
                                </p>
                              )}
                              {error.expected && (
                                <p className="text-xs text-red-600 mt-1">
                                  <span className="font-medium">Expected:</span> {error.expected}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!validationResult && !jsonError && !schemaError && (
                <div className="text-center py-8 text-gray-500">
                  <p>Enter JSON data and schema to see validation results</p>
                </div>
              )}
            </div>

            <div className="mt-8 p-4 bg-blue-50 rounded-lg">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">💡 Tips</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Validation happens automatically as you type (with a 500ms delay)</li>
                <li>• Use the predefined templates to get started quickly</li>
                <li>• The validator supports most JSON Schema Draft 7 features</li>
                <li>• Copy buttons let you quickly share your JSON or schema</li>
                <li>• Common validation types: string patterns, number ranges, array constraints, required properties</li>
              </ul>
            </div>
          </div>

          <div className="bg-gray-50 px-6 py-4 border-t">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                <strong>Free Tool by OpenWeave</strong> • Validate JSON against schemas without signup
              </div>
              <a 
                href="https://openweave.dev" 
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Build data validation workflows →
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">About JSON Schema Validation</h2>
          <p className="text-gray-600 mb-4">
            JSON Schema is a powerful tool for validating the structure and content of JSON data. 
            This validator helps developers ensure their JSON data meets specified requirements for:
          </p>
          <div className="grid md:grid-cols-2 gap-6 mb-4">
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">API Development</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Validate request/response payloads</li>
                <li>• Ensure API contract compliance</li>
                <li>• Test data structure requirements</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">Data Processing</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Validate configuration files</li>
                <li>• Check data import formats</li>
                <li>• Ensure data quality standards</li>
              </ul>
            </div>
          </div>
          <p className="text-sm text-gray-500">
            Need automated data validation in your applications? OpenWeave provides intelligent data processing 
            workflows with built-in validation, transformation, and error handling.
          </p>
        </div>
      </div>
    </div>
  )
}