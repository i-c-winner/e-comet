import { Navigate, Route, Routes } from 'react-router-dom';
import './App.scss';
import { Stats } from './features/stats/stats';
import { I18nextProvider } from 'react-i18next';
import { i18n } from './i18n/i18n.ts';

function App() {
    return (
        <I18nextProvider i18n={i18n}>
            <Routes>
                <Route path='/' element={<Navigate to='/stats' />} />
                <Route path='/stats' element={<Stats />} />
            </Routes>
        </I18nextProvider>
    );
}

export default App;
