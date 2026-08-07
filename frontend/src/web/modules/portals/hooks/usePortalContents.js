import { useEffect, useState } from 'react';
import { API } from '../../../../shared/services/api';
import { useCustomerAuth } from '../../../../shared/context/CustomerAuthContext';

export function usePortalContents(portal, language, section = '') {
  const { token } = useCustomerAuth();
  const [state, setState] = useState({ loading: true, error: '', items: [], sections: {} });

  useEffect(() => {
    const controller = new AbortController();
    setState(current => ({ ...current, loading: true, error: '' }));
    const path = section
      ? `/portals/${portal}/contents?type=${encodeURIComponent(section)}&lang=${language}&limit=50`
      : `/portals/${portal}/overview?lang=${language}`;
    fetch(API(path), { signal: controller.signal, headers: token ? { Authorization: "Bearer " + token } : {} })
      .then(async response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(data => setState({
        loading: false,
        error: '',
        items: data.items || [],
        sections: data.sections || {},
      }))
      .catch(error => {
        if (error.name !== 'AbortError') setState({ loading: false, error: error.message, items: [], sections: {} });
      });
    return () => controller.abort();
  }, [portal, language, section, token]);

  return state;
}
