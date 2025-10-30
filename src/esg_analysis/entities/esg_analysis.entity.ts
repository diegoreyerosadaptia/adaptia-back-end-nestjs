import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
  } from 'typeorm';
  import { Organization } from 'src/organizations/entities/organization.entity';
  
  @Entity('esg_analysis')
  export class EsgAnalysis {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @ManyToOne(() => Organization, (org) => org.esgAnalysis, { onDelete: 'CASCADE' })
    organization: Organization;
  
    @Column({ type: 'jsonb' })
    analysisJson: Record<string, any>;
  
    @CreateDateColumn()
    createdAt: Date;
  
    @UpdateDateColumn()
    updatedAt: Date;
  }
  
