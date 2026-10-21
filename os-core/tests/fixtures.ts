import { OsCoreService } from '../src/index.js';
import { MemoryTestPersistence, TestAuthenticator } from '../testing/memory.js';

export async function setup() {
  const persistence = new MemoryTestPersistence();
  const authenticator = new TestAuthenticator();
  for (const name of ['admin', 'lawyer', 'reviewer', 'stranger', 'other', 'assistant', 'finance']) authenticator.register({ id: name, subject: `test:${name}`, display_name: `Synthetic ${name}`, active: true }, `${name}-token`);
  const service = new OsCoreService(persistence, authenticator, () => new Date('2026-10-13T12:00:00.000Z'));
  const firm = await service.createLawFirm('admin-token', 'Estudio sintético A');
  await service.addMember('admin-token', firm.id, 'lawyer', 'LAWYER');
  await service.addMember('admin-token', firm.id, 'reviewer', 'LAWYER');
  await service.addMember('admin-token', firm.id, 'stranger', 'LAWYER');
  await service.addMember('admin-token', firm.id, 'assistant', 'ASSISTANT');
  await service.addMember('admin-token', firm.id, 'finance', 'ADMINISTRATION');
  const otherFirm = await service.createLawFirm('other-token', 'Estudio sintético B');
  const client = await service.createClient('admin-token', firm.id, { kind: 'PERSON', display_name: 'Cliente sintético privado', identification: null });
  const matter = await service.createMatter('admin-token', firm.id, { client_id: client.id, title: 'Consulta sintética', kind: 'ADVISORY', subject_area: 'Civil', responsible_identity_id: 'lawyer', opened_on: '2026-10-13', closed_on: null });
  const document = await service.createDocument('lawyer-token', firm.id, matter.id, { title: 'Documento sintético' });
  const version = await service.addDocumentVersion('lawyer-token', firm.id, matter.id, document.id, Buffer.from('CONTENIDO PRIVADO SINTÉTICO'), { mime_type: 'text/plain', original_filename: 'synthetic.txt' });
  await service.publishDocumentVersion('lawyer-token', firm.id, matter.id, document.id, version.id, null);
  const task = await service.createTask('admin-token', firm.id, matter.id, { title: 'Tarea sintética', responsible_identity_id: 'lawyer', internal_due_at: '2026-10-14T12:00:00.000Z' });
  return { service, persistence, authenticator, firm, otherFirm, client, matter, document, version, task };
}
