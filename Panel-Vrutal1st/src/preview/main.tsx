import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import '../styles/design-tokens.css';
import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets.css';
import '../styles/shell.css';
import { Preview } from './Preview';

// Sin StrictMode: el doble render no aporta nada aquí y ensucia las capturas.
createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <Preview />
  </MemoryRouter>,
);
