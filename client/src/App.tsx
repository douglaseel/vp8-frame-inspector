import React  from 'react';
import { BrowserRouter } from 'react-router-dom';
import RouterConfig from './router/RouterConfig';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <RouterConfig />
    </BrowserRouter>
  )
}

export default App;