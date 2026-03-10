import { defineRelations } from 'drizzle-orm';
import * as schema from './schema';

export const relations = defineRelations(schema, r => ({
  account: {
    user: r.one.user({
      from: r.account.userId,
      to: r.user.id,
    }),
  },
  user: {
    account: r.many.account(),
    session: r.many.session(),
    studioInterview: r.many.studioInterview(),
  },
  session: {
    user: r.one.user({
      from: r.session.userId,
      to: r.user.id,
    }),
  },
  studioInterview: {
    user: r.one.user({
      from: r.studioInterview.createdBy,
      to: r.user.id,
    }),
  },
}));
