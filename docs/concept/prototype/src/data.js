/* Codebase Inspector — deterministic, synthetic demonstration data. Not a repository scan. */
(function(){
const districts = [
 {id:'editor', name:'Editor', team:'Experience', desc:'Canvas interactions and editing tools', layer:'Presentation', color:'#8195ef', prefix:'src/editor/'},
 {id:'projects', name:'Projects', team:'Experience', desc:'Project lifecycle and workspace views', layer:'Application', color:'#aa91e8', prefix:'src/projects/'},
 {id:'assets', name:'Assets', team:'Platform', desc:'Asset definitions, catalog and previews', layer:'Application', color:'#69b6bf', prefix:'src/assets/'},
 {id:'domain', name:'Domain', team:'Core systems', desc:'Business rules and cost calculations', layer:'Domain', color:'#dba46e', prefix:'src/domain/'},
 {id:'storage', name:'Storage', team:'Platform', desc:'Persistence, migrations and adapters', layer:'Infrastructure', color:'#8a9dc7', prefix:'src/storage/'},
 {id:'shared', name:'Shared', team:'Core systems', desc:'Primitives and cross-cutting utilities', layer:'Foundation', color:'#a097c4', prefix:'src/shared/'}
];
const names = {
 editor:['PlanEditor','SelectionManager','CanvasRenderer','ToolRegistry','HistoryManager','SnapEngine','ViewportController','WallTool','RoomTool','DimensionTool','AssetPlacement','KeyboardBindings','SelectionBounds','CanvasLayer','GridRenderer','MeasureTool','TransformTool','PointerEvents','EditorState','DrawingSession','HitTesting','ClipboardService','ContextMenu','RenderScheduler'],
 projects:['ProjectView','ProjectStore','ProjectService','MilestoneBoard','ProjectDetails','BudgetSummary','ProjectCard','PhaseService','DocumentList','ProjectFilters','ProjectFactory','ScheduleView','TaskList','ProjectSerializer','ContractorView','CostBreakdown','ProgressView','ProjectSettings','ProjectActions','WorkspaceState','ProjectSearch','ProjectOverview','ProjectValidation','ProjectEvents'],
 assets:['AssetLibrary','AssetDesigner','AssetLoader','PreviewRenderer','CatalogService','AssetSearch','AssetRegistry','AssetSerializer','AssetTypes','AssetValidator','AssetPicker','ThumbnailCache','AssetInspector','DimensionEditor','AssetTransform','AssetCollection','TagService','AssetImporter','AssetExporter','AssetBrowser','AssetTemplates','AssetStore','AssetMetadata','AssetEvents'],
 domain:['CostEngine','BudgetService','MaterialCalculator','PlanModel','ProjectModel','PriceResolver','QuantityRules','ValidationRules','CostAllocation','RequirementModel','RenovationPhase','ScopeDefinition','Measurement','UnitConverter','QuoteComparison','ScheduleRules','CostCategory','BudgetForecast','RiskAssessment','TradeDefinition','PlanValidation','AllocationRules','Money','DomainEvents'],
 storage:['VaultRepository','MigrationRunner','ProjectAdapter','FileWatcher','AtomicWriter','SchemaValidator','JsonSerializer','CacheStore','StoragePort','TransactionLog','BackupService','PathResolver','NoteAdapter','MetadataIndex','FileQueue','ReadModel','SyncState','DataVersion','VaultScanner','StorageConfig','ChangeJournal','RecordMapper','IndexRebuilder','PersistenceEvents'],
 shared:['EventBus','Logger','DateUtils','TypeGuards','Result','Disposable','Debounce','Observable','UniqueId','MathUtils','ColorUtils','StringUtils','CollectionUtils','AsyncQueue','PathUtils','ValidationError','AppError','Coordinate','Geometry','LoggerTypes','Constants','Configuration','FeatureFlags','LegacyHelpers']
};
function rand(i){ const x=Math.sin(i*127.1+311.7)*43758.5453; return x-Math.floor(x); }
let files=[];
districts.forEach((d,di)=>names[d.id].forEach((name,i)=>{
 const seed=di*29+i+1; const branches=20+Math.floor(rand(seed+6)*160);
 files.push({id:d.id+'-'+i, name:name+'.ts', path:d.prefix+name+'.ts', district:d.id, team:d.team,
 loc:Math.round(80+Math.pow(rand(seed),2)*1390), complexity:3+Math.floor(Math.pow(rand(seed+2),2)*42),
 churn:1+Math.floor(Math.pow(rand(seed+3),1.5)*42), branches, covered:Math.round(branches*(.40+rand(seed+4)*.59)),
 direct:1+Math.floor(rand(seed+5)*18), unused:rand(seed+7)>.75?1+Math.floor(rand(seed+8)*4):0,
 duplicate:rand(seed+9)>.79?Math.round(4+rand(seed+10)*14):0, last:1+Math.floor(rand(seed+11)*26),
 knowledge:Math.round(40+rand(seed+12)*55), contributors:1+Math.floor(rand(seed+13)*6)});
}));
Object.assign(files.find(f=>f.name==='CostEngine.ts'),{loc:1248,complexity:42,churn:31,branches:100,covered:46,direct:27,unused:2,duplicate:12,knowledge:86,contributors:2,last:1});
Object.assign(files.find(f=>f.name==='SelectionManager.ts'),{loc:1086,complexity:38,churn:39,branches:100,covered:52,direct:19,unused:0,duplicate:4});
Object.assign(files.find(f=>f.name==='VaultRepository.ts'),{loc:894,complexity:34,churn:28,branches:100,covered:61,direct:21,unused:1,duplicate:0});
Object.assign(files.find(f=>f.name==='LegacyHelpers.ts'),{loc:308,complexity:13,churn:2,branches:100,covered:0,direct:0,unused:8,duplicate:16});
Object.assign(files.find(f=>f.name==='AssetLoader.ts'),{loc:620,complexity:28,churn:32,branches:100,covered:58,direct:16,unused:0,duplicate:8});
const edges=[['editor','projects',14],['editor','assets',22],['editor','domain',38],['editor','shared',31],['projects','domain',29],['projects','storage',18],['projects','shared',12],['assets','domain',11],['assets','storage',15],['assets','shared',20],['domain','shared',37],['storage','domain',25],['storage','shared',28],['domain','storage',3]];
const packages=[
 {name:'@sample/document-parser',version:'2.4.0',license:'MIT',type:'Direct',used:12,status:'Review',issue:'DEMO-ADV-001',note:'Synthetic advisory: unsafe parsing of untrusted documents.',next:'2.4.2'},
 {name:'@sample/archive-reader',version:'1.8.1',license:'Apache-2.0',type:'Transitive',used:3,status:'Review',issue:'DEMO-ADV-002',note:'Synthetic advisory: archive path validation requires review.',next:'1.8.3'},
 {name:'@sample/ui-kit',version:'4.2.0',license:'MIT',type:'Direct',used:31,status:'Current',issue:null,next:'4.2.0'},
 {name:'@sample/geometry',version:'3.1.2',license:'MIT',type:'Direct',used:22,status:'Current',issue:null,next:'3.1.2'},
 {name:'@sample/serializer',version:'2.7.0',license:'MIT',type:'Direct',used:19,status:'Current',issue:null,next:'2.7.0'},
 {name:'@sample/date-utils',version:'1.3.4',license:'MIT',type:'Direct',used:7,status:'Update',issue:null,next:'1.4.0'},
 {name:'@sample/legacy-icons',version:'0.9.0',license:'Unresolved',type:'Direct',used:0,status:'Unused',issue:null,next:'1.0.0'},
 {name:'@sample/schema',version:'3.0.2',license:'MIT',type:'Transitive',used:16,status:'Current',issue:null,next:'3.0.2'},
 {name:'@sample/worker',version:'1.1.0',license:'Apache-2.0',type:'Direct',used:4,status:'Current',issue:null,next:'1.1.0'},
 {name:'@sample/test-fixtures',version:'2.0.0',license:'MIT',type:'Development',used:15,status:'Current',issue:null,next:'2.0.0'}
];
const initialTasks=[
 {id:'RF-001',title:'Separate cost calculation from persistence',file:'domain-0',status:'Investigate',priority:'High',owner:'Core systems',notes:'Confirm the three Domain → Storage imports. Introduce a port and cover rounding behavior before extracting the adapter.',checklist:[false,false,false]},
 {id:'RF-002',title:'Add regression tests for selection changes',file:'editor-1',status:'Planned',priority:'High',owner:'Experience',notes:'Characterize multi-select, undo and keyboard behavior before changing the selection manager.',checklist:[true,false,false]},
 {id:'RF-003',title:'Retire unused legacy helpers',file:'shared-23',status:'In progress',priority:'Medium',owner:'Core systems',notes:'Verify all configured entry points and dynamic references before removing exports.',checklist:[true,true,false]},
 {id:'RF-004',title:'Document the vault persistence boundary',file:'storage-0',status:'Verified',priority:'Medium',owner:'Platform',notes:'Architecture decision recorded and dependency rule added to the illustrative baseline.',checklist:[true,true,true]}
];
const rules=[
 {id:'AR-001',title:'Domain must not import Storage',from:'domain',to:'storage',status:'Violation',count:3,detail:'Keep business rules independent of vault persistence. Depend on a domain-owned port instead.',paths:['src/domain/CostEngine.ts → src/storage/VaultRepository.ts','src/domain/BudgetService.ts → src/storage/ProjectAdapter.ts','src/domain/PriceResolver.ts → src/storage/CacheStore.ts']},
 {id:'AR-002',title:'Shared must not import feature modules',status:'Passing',count:0,detail:'Shared primitives remain independent of feature modules.'},
 {id:'AR-003',title:'Persistence access goes through Storage',status:'Passing',count:0,detail:'Keep filesystem effects behind adapters.'},
 {id:'AR-004',title:'Feature-to-feature imports are explicit',status:'Review',count:14,detail:'Editor imports Projects. Review whether this is an intentional application boundary.'},
 {id:'AR-005',title:'Production code must not import tests',status:'Passing',count:0,detail:'Test-only utilities are excluded from production entry points.'}
];
function snapshotFiles(baseline=false){return files.map((f,i)=>baseline?{...f,loc:Math.round(f.loc*.94),complexity:f.complexity+(i%4===0?4:1),churn:Math.max(0,f.churn-3),covered:Math.max(0,f.covered-Math.round(f.branches*.06)),unused:f.unused+(i%14===0?1:0)}:{...f});}
function coverage(f){return Math.round(f.covered/f.branches*100);}
function risk(f){return Math.round(Math.min(100,(f.complexity/48*.42+f.churn/44*.35+(1-f.covered/f.branches)*.23)*100));}
function issuesFor(list){let out=[];list.forEach(f=>{
 if(f.complexity>25)out.push({id:'CX-'+f.id,type:'Complexity',title:'Complex function needs review',file:f.id,severity:f.complexity>=38?'High':'Medium',provider:'Complexity fixture',detail:`Maximum function cognitive complexity is ${f.complexity}. Review the function before selecting an extraction boundary.`,line:42});
 if(f.unused)out.push({id:'UN-'+f.id,type:'Unused exports',title:`${f.unused} potentially unused export${f.unused>1?'s':''}`,file:f.id,severity:'Low',provider:'Static-analysis fixture',detail:'No references were found in this sample entry-point graph. Dynamic use and configuration must be verified before deletion.',line:18});
 if(f.duplicate)out.push({id:'DU-'+f.id,type:'Duplication',title:'Repeated implementation detected',file:f.id,severity:'Medium',provider:'Duplication fixture',detail:`${f.duplicate}% duplicated lines in this illustrative file. Review semantics before consolidating.`,line:76});
 });return out;}
window.CIData={districts,files,edges,packages,initialTasks,rules,snapshotFiles,coverage,risk,issuesFor};
})();
