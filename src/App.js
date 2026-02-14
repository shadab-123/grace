import React from 'react';
import { Container } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import Dashboard from './Dashboard';

const App = () => {
    return (
        <Container fluid className="app-container">
            <Dashboard />
        </Container>
    );
};

export default App;