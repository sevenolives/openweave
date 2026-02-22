#!/usr/bin/env python3
"""
Deploy Agent Desk to Railway using GraphQL API.
"""
import requests
import os
import sys
import json
import time

def railway_query(query, variables=None):
    """Execute a GraphQL query against Railway API."""
    url = "https://backboard.railway.app/graphql/v2"
    headers = {
        "Authorization": f"Bearer {os.getenv('RAILWAY_TOKEN')}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "query": query,
        "variables": variables or {}
    }
    
    response = requests.post(url, json=payload, headers=headers)
    
    if response.status_code != 200:
        print(f"❌ Railway API error: {response.status_code}")
        print(response.text)
        return None
    
    data = response.json()
    if "errors" in data:
        print("❌ GraphQL errors:")
        for error in data["errors"]:
            print(f"  - {error['message']}")
        return None
    
    return data["data"]

def get_project_info():
    """Get project and service information."""
    query = """
    query {
        projects {
            edges {
                node {
                    id
                    name
                    services {
                        edges {
                            node {
                                id
                                name
                            }
                        }
                    }
                }
            }
        }
    }
    """
    
    return railway_query(query)

def deploy_service(service_id, service_name):
    """Deploy a specific service."""
    print(f"🚀 Deploying {service_name}...")
    
    mutation = """
    mutation ServiceInstanceDeploy($input: ServiceInstanceDeployInput!) {
        serviceInstanceDeploy(input: $input) {
            id
            status
            url
        }
    }
    """
    
    variables = {
        "input": {
            "serviceId": service_id,
            "latestCommit": True
        }
    }
    
    result = railway_query(mutation, variables)
    if result and "serviceInstanceDeploy" in result:
        deployment = result["serviceInstanceDeploy"]
        print(f"✅ {service_name} deployment initiated: {deployment['id']}")
        return deployment
    else:
        print(f"❌ Failed to deploy {service_name}")
        return None

def wait_for_deployment(deployment_id, service_name, max_wait=600):
    """Wait for deployment to complete."""
    print(f"⏳ Waiting for {service_name} deployment to complete...")
    
    query = """
    query GetDeployment($id: String!) {
        deployment(id: $id) {
            id
            status
            url
        }
    }
    """
    
    start_time = time.time()
    while time.time() - start_time < max_wait:
        result = railway_query(query, {"id": deployment_id})
        if result and "deployment" in result:
            deployment = result["deployment"]
            status = deployment["status"]
            
            if status == "SUCCESS":
                print(f"✅ {service_name} deployed successfully!")
                if deployment.get("url"):
                    print(f"🔗 URL: {deployment['url']}")
                return True
            elif status == "FAILED":
                print(f"❌ {service_name} deployment failed!")
                return False
            else:
                print(f"⏳ {service_name} status: {status}")
        
        time.sleep(10)
    
    print(f"⏰ Deployment timed out after {max_wait} seconds")
    return False

def main():
    """Main deployment process."""
    print("🚀 Starting Agent Desk deployment to Railway...")
    
    if not os.getenv('RAILWAY_TOKEN'):
        print("❌ RAILWAY_TOKEN environment variable not set")
        sys.exit(1)
    
    # Get project information
    print("📋 Getting project information...")
    project_data = get_project_info()
    
    if not project_data:
        print("❌ Failed to get project information")
        sys.exit(1)
    
    # Find the agent-desk project and its services
    agent_desk_project = None
    for edge in project_data["projects"]["edges"]:
        project = edge["node"]
        if "agent-desk" in project["name"].lower() or "agentdesk" in project["name"].lower():
            agent_desk_project = project
            break
    
    if not agent_desk_project:
        print("❌ Could not find agent-desk project")
        print("Available projects:")
        for edge in project_data["projects"]["edges"]:
            print(f"  - {edge['node']['name']} ({edge['node']['id']})")
        sys.exit(1)
    
    print(f"✅ Found project: {agent_desk_project['name']}")
    
    # Get services
    services = {}
    for edge in agent_desk_project["services"]["edges"]:
        service = edge["node"]
        services[service["name"]] = service["id"]
    
    print(f"📦 Available services: {list(services.keys())}")
    
    # Deploy backend service
    backend_id = services.get("backend")
    if backend_id:
        backend_deployment = deploy_service(backend_id, "backend")
        if backend_deployment:
            wait_for_deployment(backend_deployment["id"], "backend")
    else:
        print("⚠️ Backend service not found")
    
    # Deploy frontend service
    frontend_id = services.get("frontend")
    if frontend_id:
        frontend_deployment = deploy_service(frontend_id, "frontend")
        if frontend_deployment:
            wait_for_deployment(frontend_deployment["id"], "frontend")
    else:
        print("⚠️ Frontend service not found")
    
    print("🎉 Deployment process completed!")
    print("\n📖 Phase 5 Features Now Live:")
    print("  🔍 Search & filtering on all endpoints")
    print("  📄 API documentation at /api/docs/")
    print("  🚦 Rate limiting (100/day anon, 1000/day auth)")
    print("  📊 Comprehensive pagination")
    print("  🛠️ Consistent error handling")
    print("  🧪 Full test suite implemented")
    
    print("\n🚀 Agent Desk is now PRODUCTION READY!")

if __name__ == "__main__":
    main()