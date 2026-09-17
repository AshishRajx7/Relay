import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Prospect, ProspectResearchStatus } from './entities/prospect.entity';

@Injectable()
export class ProspectsService {
  constructor(
    @InjectRepository(Prospect)
    private readonly prospectRepository: Repository<Prospect>,
  ) {}

  async findByCampaign(campaignId: string, status?: ProspectResearchStatus): Promise<Prospect[]> {
    const query = this.prospectRepository
      .createQueryBuilder('prospect')
      .leftJoinAndSelect('prospect.companyProfile', 'companyProfile')
      .where('prospect.campaign_id = :campaignId', { campaignId });

    if (status) {
      query.andWhere('prospect.research_status = :status', { status });
    }

    return query.orderBy('prospect.created_at', 'ASC').getMany();
  }

  async findOne(id: string): Promise<Prospect> {
    if (!id || typeof id !== 'string' || !id.trim()) {
      throw new BadRequestException('Invalid prospect ID provided');
    }
    const prospect = await this.prospectRepository.findOne({
      where: { id },
      relations: ['companyProfile', 'campaign'],
    });
    if (!prospect) {
      throw new NotFoundException(`Prospect with ID ${id} not found`);
    }
    return prospect;
  }
}
