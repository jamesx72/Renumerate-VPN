import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yjsxqsgviwfkeipmeyex.supabase.co';
const supabaseKey = 'sb_publishable_mG1lI0bLadShkiEpX849Kw_sjocGIvw';

export const supabase = createClient(supabaseUrl, supabaseKey);