import AppContainer from '@/components/AppContainer';
import { workspaceSlugToView } from '@/lib/demoSherpa/hostRoutes';

export default async function WorkspacePage(props) {
  const params = await props.params;
  const initialView = workspaceSlugToView(params?.slug || []);
  return <AppContainer initialView={initialView} />;
}
