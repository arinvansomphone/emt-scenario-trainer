# EMT Scenario Trainer

A comprehensive AI-powered training platform for Emergency Medical Technicians (EMTs) that provides realistic, interactive scenario-based learning experiences.

## 🚑 Overview

The EMT Scenario Trainer is an advanced simulation platform that creates dynamic, medically accurate training scenarios for EMT students and professionals. Using AI-powered patient simulation, the system provides realistic emergency scenarios with adaptive patient responses, vital sign monitoring, and performance evaluation.

## ✨ Features

### 🎭 Dynamic Scenario Generation

- **Trauma Scenarios**: MVC, Falls, Assaults, Sport Injuries, Stabbings, GSW, Burns
- **Medical Scenarios**: Cardiac, Respiratory, Neurological, Metabolic, Abdominal, Environmental, OB/GYN
- **Realistic Dispatch Information**: Location-specific, time-accurate, detailed mechanism descriptions
- **Category Enforcement**: Ensures proper scenario categorization (trauma vs medical)

### 🤖 AI-Powered Patient Simulation

- **Adaptive Patient Responses**: Realistic patient reactions to EMT interventions
- **Dynamic Vital Signs**: Time-progressive vital sign changes based on interventions
- **Consciousness Management**: Patient alertness changes throughout scenarios
- **Intervention Tracking**: Records and responds to EMT actions and treatments

### 📊 Performance Evaluation

- **Real-time Assessment**: Tracks EMT actions and decision-making
- **Comprehensive Scoring**: Evaluates multiple performance aspects
- **Detailed Feedback**: Provides strengths and areas for improvement
- **Scenario Completion Reports**: Summary of performance and time management

### 🌍 Environmental & Bystander Management

- **Scene Realism**: Environmental factors affecting patient presentation
- **Bystander Interactions**: Realistic bystander responses and information
- **Dynamic Scene Evolution**: Changing conditions throughout scenarios

### 💬 Interactive Communication

- **Voice Input Support**: Practice verbal communication skills
- **Natural Language Processing**: Understands EMT commands and questions
- **Contextual Responses**: Patient and bystander responses based on scenario context

## 🛠️ Technology Stack

### Frontend

- **React 19** - Modern UI framework
- **Vite** - Fast build tool and development server
- **React Router DOM** - Client-side routing
- **CSS3** - Styling with modern design principles

### Backend

- **Node.js** - Server runtime
- **Express.js** - Web framework
- **OpenAI GPT-4o-mini** - AI scenario generation and patient simulation
- **PDF Processing** - Knowledge base integration from medical documents

### Development Tools

- **Nodemon** - Auto-restart development server
- **ESLint** - Code quality and consistency
- **Concurrently** - Run frontend and backend simultaneously

## 🚀 Quick Start

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- OpenAI API key

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/arinvansomphone/emt-scenario-trainer.git
   cd emt-scenario-trainer
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:

   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   PORT=3000
   NODE_ENV=development
   ```

4. **Start the application**

   ```bash
   # Start both frontend and backend
   npm run dev:all

   # Or start individually:
   npm run dev:backend    # Backend only (port 3000)
   npm run dev:frontend   # Frontend only (port 5173)
   ```

5. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000

## 📖 Usage

### Starting a Scenario

1. Select a scenario type from the main menu
2. Choose a specific sub-scenario (e.g., MVC, Cardiac, etc.)
3. Review the dispatch information
4. Click "Ready to Begin" to start the simulation

### During Simulation

- **Communicate naturally** with the patient and bystanders
- **Perform assessments** using standard EMT protocols
- **Monitor vital signs** and patient responses
- **Make treatment decisions** based on findings
- **Use voice input** for realistic communication practice

### Scenario Completion

- Receive comprehensive performance evaluation
- Review strengths and areas for improvement
- Get detailed feedback on decision-making and interventions

## 🏗️ Project Structure

```
emt-chatbot/
├── src/                    # React frontend components
├── services/              # Backend business logic
│   ├── chatService.js     # Main chat and scenario logic
│   ├── scenarioGenerator.js # AI scenario generation
│   ├── patientSimulator.js # Patient simulation engine
│   ├── processors/        # Data processing modules
│   └── utils/            # Utility functions
├── routes/               # Express API routes
├── config/              # Configuration files
├── knowledge/           # Medical knowledge base
└── public/             # Static assets
```

## 🔧 Development

### Available Scripts

- `npm run dev:all` - Start both frontend and backend
- `npm run dev:backend` - Start backend only
- `npm run dev:frontend` - Start frontend only
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

### Key Components

- **Scenario Generation**: AI-powered creation of realistic emergency scenarios
- **Patient Simulation**: Dynamic patient responses and vital sign management
- **Performance Evaluation**: Real-time assessment of EMT performance
- **Environmental Management**: Scene realism and bystander interactions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the ISC License.

## 🆘 Support

For support, please open an issue in the GitHub repository or contact the development team.

---

**Built with ❤️ for EMT education and training**
