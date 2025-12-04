import { Button, Container } from 'react-bootstrap';
import { useState } from 'react';
import i18n from 'i18next';

function HeaderButtons() {
    const [isDark, setIsDark] = useState<boolean>(document.documentElement.dataset.bsTheme === 'dark');
    const toggleTheme = () => {
        setIsDark(!isDark);
        document.documentElement.dataset.bsTheme = isDark ? 'light' : 'dark';
    };
    return (
        <Container className='d-flex justify-content-end'>
            <Button className='btn btn-primary me-1' onClick={() => i18n.changeLanguage('ru')}>
                ru
            </Button>
            <Button className='btn btn-primary me-1' onClick={() => i18n.changeLanguage('en')}>
                en
            </Button>
            <Button className='btn btn-primary d-flex align-items-center gap-2' onClick={toggleTheme}>
                <span style={{ display: 'flex', alignItems: 'center' }}>{isDark ? '🌞' : '🌙'}</span>
                <span>{isDark ? 'Light' : 'Dark'}</span>
            </Button>
        </Container>
    );
}

export { HeaderButtons };
