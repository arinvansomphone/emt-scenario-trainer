# EMT Scenario Trainer

A comprehensive AI-powered training platform for Emergency Medical Technicians (EMTs) that provides realistic, interactive scenario-based learning experiences.

**🌐 Live Demo**: [https://arinvansomphone.github.io/emt-scenario-trainer/](https://arinvansomphone.github.io/emt-scenario-trainer/)

## 🚑 Overview

The EMT Scenario Trainer is an advanced simulation platform that creates dynamic, medically accurate training scenarios for EMT students and professionals. Using AI-powered patient simulation, the system provides realistic emergency scenarios with adaptive patient responses, vital sign monitoring, and performance evaluation.

## ✨ Features

### 🎭 Dynamic Scenario Generation

- **Trauma Scenarios**: MVC, Falls, Assaults, Sport Injuries, Stabbings, GSW, Burns
- **Medical Scenarios**: Cardiac, Respiratory, Neurological, Metabolic, Obstetric, Pediatric
- **Environmental Factors**: Weather conditions, lighting, noise levels, bystander presence
- **Adaptive Difficulty**: Scenarios adjust based on student performance

### 🤖 AI-Powered Patient Simulation

- **Realistic Patient Responses**: Dynamic vital signs, symptoms, and condition changes
- **Interactive Communication**: Natural language patient interactions
- **Vital Sign Monitoring**: Real-time SpO2, blood pressure, heart rate, respiratory rate
- **Condition Progression**: Patient status evolves based on interventions

### 📊 Performance Evaluation

- **Assessment Rubrics**: Stanford EMT Medical and Trauma Assessment criteria
- **Real-time Feedback**: Immediate evaluation of assessment quality
- **Progress Tracking**: Detailed performance analytics and improvement suggestions
- **Competency Mapping**: Skills assessment across multiple domains

### 🌍 Environmental & Bystander Management

- **Dynamic Environments**: Changing weather, lighting, and scene conditions
- **Bystander Interactions**: Realistic witness statements and interference
- **Scene Safety**: Environmental hazards and safety considerations
- **Resource Management**: Limited equipment and personnel scenarios

### 💬 Interactive Communication

- **Natural Language Processing**: Voice and text input recognition
- **Multi-modal Input**: Speech-to-text and keyboard input support
- **Context-Aware Responses**: Intelligent scenario progression
- **Real-time Adaptation**: Dynamic scenario adjustments

## 🛠️ Local Setup

### Prerequisites

- Node.js 18+ and npm
- [OpenAI API key](https://platform.openai.com/api-keys)

### Quick Start

1. **Clone the repository** and install dependencies:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your OpenAI API key:
   ```
   OPENAI_API_KEY=sk-...
   ```

3. **Start the server**:
   ```bash
   npm start
   ```
   Backend runs at http://localhost:3000

4. **Start the frontend** (in a second terminal):
   ```bash
   npm run dev:frontend
   ```
   Open http://localhost:5173 in your browser

5. **Or run both together**:
   ```bash
   npm run dev:all
   ```

## 🚀 Usage

### Using the Scenario Trainer

1. **Select a Scenario Type**

   - Choose from Trauma or Medical scenarios
   - Select specific subcategories (MVC, Cardiac, etc.)

2. **Begin Assessment**

   - Follow standard EMT assessment protocols
   - Interact with the AI patient through natural language
   - Monitor vital signs and patient responses

3. **Receive Feedback**

   - Get real-time performance evaluation
   - Review assessment quality scores
   - Identify areas for improvement

4. **Practice and Improve**
   - Repeat scenarios with different variations
   - Track progress over time
   - Master assessment techniques
