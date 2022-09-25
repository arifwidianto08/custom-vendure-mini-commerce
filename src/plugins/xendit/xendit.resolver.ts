import { Mutation, Resolver } from '@nestjs/graphql';
import {
	ActiveOrderService,
	Allow,
	Ctx,
	Permission,
	RequestContext,
} from '@vendure/core';
import { XenditCreateInvoiceResponse } from './types';

import { XenditService } from './xendit.service';

@Resolver()
export class XenditResolver {
	constructor(
		private xenditService: XenditService,
		private activeOrderService: ActiveOrderService,
	) {}

	@Mutation()
	@Allow(Permission.Owner)
	async createXenditPayment(
		@Ctx() ctx: RequestContext,
	): Promise<XenditCreateInvoiceResponse | undefined> {
		if (ctx.authorizedAsOwnerOnly) {
			const sessionOrder = await this.activeOrderService.getOrderFromContext(
				ctx,
			);

			if (sessionOrder) {
				return this.xenditService.createPayment(ctx, sessionOrder);
			}
		}
	}
}
